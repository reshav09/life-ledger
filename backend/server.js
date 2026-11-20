const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const requireAuth = require('./middleware/requireAuth');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const { router: authRouter } = require('./routes/auth');
const { runMigrationsWithRetry } = require('./db/migrate');
const { seedStandalone } = require('./scripts/seedStandalone');
const { scheduleAutoBackup } = require('./services/backup');
const pool = require('./db/db');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Structured request logging ──
app.use(requestLogger);

// ── Security headers ──
app.use(helmet({
  contentSecurityPolicy: false, // SPA needs inline styles/scripts
  crossOriginEmbedderPolicy: false
}));

// ── Rate limiting ──
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' }
}));

app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
}));

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '25mb' }));
app.use(cookieParser());

// ── Enhanced health check ──
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      db: 'connected',
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  } catch {
    res.status(503).json({
      status: 'degraded',
      db: 'disconnected',
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  }
});

// Authentication endpoints
app.use('/api/auth', authRouter);

// Everything below this requires an active session
app.use('/api', requireAuth);

// ── Job Hunt Ledger Core Endpoints ──
app.use('/api/applications', require('./routes/applications'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/ai', require('./routes/ai'));

// Organization discovery, opportunity scoring, career profile, AI extraction & crawler
app.use('/api/jobhunt/profile', require('./routes/jobhuntProfile'));
app.use('/api/jobhunt/orgs', require('./routes/jobhuntOrgs'));
app.use('/api/jobhunt/opportunities', require('./routes/jobhuntOpportunities'));
app.use('/api/jobhunt/prep', require('./routes/jobhuntPrep'));
app.use('/api/jobhunt/documents', require('./routes/jobhuntDocuments'));
app.use('/api/jobhunt', require('./routes/jobhuntIngest'));
app.use('/api/backup', require('./routes/backup'));

// Centralized API error handler
app.use('/api', errorHandler);

// ── Serve the built frontend ──
const frontendDist = path.join(__dirname, 'public');
app.use(express.static(frontendDist, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Global fallback error handler
app.use(errorHandler);

let server;
let stopJobHuntWorker;

(async () => {
  try {
    // 1. Run migrations
    await runMigrationsWithRetry();

    // 2. Run seed check (populates 350+ orgs & opportunities if database is fresh)
    await seedStandalone();

    // 3. Weekly backup schedule
    scheduleAutoBackup();

    // 4. Background document generator worker
    if (process.env.JOBHUNT_GENERATION_ENABLED !== '0') {
      stopJobHuntWorker = require('./services/jobhuntGenerationJobs').startGenerationWorker();
    }

    // 5. Automated Background Web Crawler
    const { startBackgroundCrawler } = require('./services/jobhuntCrawler');
    startBackgroundCrawler();

    // 6. Automated Opportunities Lifecycle Maintenance (purge expired deadlines)
    const { runOpportunitiesLifecycle } = require('./services/jobhuntLifecycle');
    runOpportunitiesLifecycle().catch((err) => console.error('[Lifecycle Startup Error]:', err.message));
    setInterval(() => {
      runOpportunitiesLifecycle().catch((err) => console.error('[Lifecycle Interval Error]:', err.message));
    }, 60 * 60 * 1000);

    // ── 7. Scheduled 12-Hour Automated Job Data Refresh ──
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
    async function run12HourSync() {
      console.log('⏰ [12-Hour Scheduler] Starting scheduled automated refresh & lifecycle maintenance...');
      try {
        const refreshAllData = require('./scripts/refreshAllData');
        await refreshAllData();
        await runOpportunitiesLifecycle();
        console.log('✅ [12-Hour Scheduler] Automated refresh completed successfully.');
      } catch (err) {
        console.error('❌ [12-Hour Scheduler Error]:', err.message);
      }
    }

    // Trigger initial refresh 45 seconds after boot (allowing DB to stabilize), then every 12 hours
    setTimeout(() => {
      run12HourSync().catch(console.error);
    }, 45 * 1000);
    setInterval(run12HourSync, TWELVE_HOURS_MS);

    // Start HTTP Server
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Job Hunt Standalone OS running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
})();

// ── Graceful shutdown ──
async function shutdown(signal) {
  stopJobHuntWorker?.();
  console.log(`\n${signal} received — shutting down gracefully…`);
  if (server) {
    server.close(async () => {
      try {
        await pool.end();
        console.log('Database pool closed.');
      } catch { /* best-effort */ }
      process.exit(0);
    });
  }
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
