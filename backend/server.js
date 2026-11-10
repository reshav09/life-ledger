const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const https = require('https');
const requireAuth = require('./middleware/requireAuth');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const { router: authRouter } = require('./routes/auth');
const { runMigrationsWithRetry } = require('./db/migrate');
const { scheduleAutoBackup } = require('./services/backup');
const pool = require('./db/db');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Structured request logging ──
app.use(requestLogger);

// ── Security headers ──
// Helmet sets a sensible default set of HTTP security headers (CSP, HSTS,
// X-Frame-Options, etc.). The contentSecurityPolicy is relaxed for the SPA
// since it needs inline styles/scripts from Vite's build output.
app.use(helmet({
  contentSecurityPolicy: false, // SPA needs inline styles/scripts
  crossOriginEmbedderPolicy: false // Allow loading external AI model resources
}));

// ── Rate limiting ──
// Login endpoint: 5 attempts per 15 minutes to prevent brute-force
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' }
}));

// General API: 200 requests per minute per IP
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
}));

app.use(cors({ origin: true, credentials: true }));
// Raised from the default 100kb so a full-data backup restore can be uploaded in one go.
app.use(express.json({ limit: '25mb' }));
app.use(cookieParser());

// ── Enhanced health check ──
// Returns DB connectivity status + uptime for Docker HEALTHCHECK and K8s probes.
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

app.use('/api/auth', authRouter);

// Everything below this line requires a valid, unexpired login session
app.use('/api', requireAuth);

app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/salary', require('./routes/salary'));
app.use('/api/budgets', require('./routes/budgets'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/savings', require('./routes/savings'));
app.use('/api/loans', require('./routes/loans'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/routine', require('./routes/routine'));
app.use('/api/applications', require('./routes/applications'));

// Job Hunt Ledger — organization discovery, opportunity scoring, career profile, AI extraction & crawler
app.use('/api/jobhunt/profile', require('./routes/jobhuntProfile'));
app.use('/api/jobhunt/orgs', require('./routes/jobhuntOrgs'));
app.use('/api/jobhunt/opportunities', require('./routes/jobhuntOpportunities'));
app.use('/api/jobhunt/prep', require('./routes/jobhuntPrep'));
app.use('/api/jobhunt', require('./routes/jobhuntIngest'));

// Diet & Health Ledger — reads from Money/Routine where relevant, never writes to them
app.use('/api/health-profile', require('./routes/health'));
app.use('/api/diet', require('./routes/diet'));
app.use('/api/gym-spending', require('./routes/gymSpending'));
app.use('/api/diet-plan', require('./routes/dietPlan'));

// AI Analyzer — reads across all ledgers via a controlled context, is not itself a source of truth
app.use('/api/ai', require('./routes/ai'));

// Centralized API error handler (catches next(err) from any route)
app.use('/api', errorHandler);

// Serve the built frontend
const frontendDist = path.join(__dirname, 'public');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Global fallback error handler
app.use(errorHandler);

let server;

(async () => {
  await runMigrationsWithRetry();
  scheduleAutoBackup();

  // Start Job Hunt Automated Crawler
  const { startBackgroundCrawler } = require('./services/jobhuntCrawler');
  startBackgroundCrawler();

  // Run Job Hunt Opportunities Lifecycle Maintenance (Purge expired deadlines, archive stale private >15d / govt >20d)
  const { runOpportunitiesLifecycle } = require('./services/jobhuntLifecycle');
  runOpportunitiesLifecycle().catch((err) => console.error('[JobHunt Lifecycle Startup Error]:', err.message));
  setInterval(() => {
    runOpportunitiesLifecycle().catch((err) => console.error('[JobHunt Lifecycle Interval Error]:', err.message));
  }, 60 * 60 * 1000);

  // Start HTTP Server
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Life Ledger running on port ${PORT} (http://localhost:5000)`);
  });
})();

// ── Graceful shutdown ──
// Handles SIGTERM (Docker stop) and SIGINT (Ctrl+C) so in-flight requests
// finish cleanly and DB connections are released before the process exits.
async function shutdown(signal) {
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
  // Force exit after 10 seconds if graceful shutdown stalls
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
