const express = require('express');
const compression = require('compression');
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

// Trust reverse proxy (Render, Cloudflare, etc.) for client IP detection in rate limiting
app.set('trust proxy', 1);

// ── HTTP response compression (gzip/deflate) ──
app.use(compression());

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

// ── Enhanced health check with Sanctuary Theme UI ──
app.get(['/api/health', '/health'], async (req, res) => {
  let dbStatus = 'disconnected';
  let dbError = null;
  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch (err) {
    dbError = err.message;
  }

  const uptime = Math.floor(process.uptime());
  const h = Math.floor(uptime / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  const s = uptime % 60;
  const uptimeStr = `${h}h ${m}m ${s}s`;

  const isConnected = dbStatus === 'connected';

  // If viewed directly in browser, render Sanctuary Dark Glass Telemetry Page
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>System Health · Job Radar OS</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: radial-gradient(ellipse at 50% 20%, #171d2b 0%, #0a0d14 100%);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #e2e8f0;
      overflow: hidden;
    }
    .veil {
      position: fixed; inset: 0;
      background: radial-gradient(circle at 50% 10%, rgba(124, 58, 237, 0.12), transparent 60%);
      pointer-events: none;
    }
    .card {
      position: relative;
      width: 100%;
      max-width: 480px;
      padding: 32px;
      background: rgba(23, 29, 43, 0.75);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(124, 58, 237, 0.15);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    }
    .icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px; height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(124, 58, 237, 0.35), rgba(79, 70, 229, 0.2));
      border: 1px solid rgba(124, 58, 237, 0.4);
      font-size: 22px;
    }
    .title { font-size: 17px; font-weight: 700; color: #fff; letter-spacing: -0.01em; }
    .badge {
      font-size: 10.5px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #a78bfa;
      font-weight: 600;
    }
    .status-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-radius: 12px;
      background: ${isConnected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)'};
      border: 1px solid ${isConnected ? 'rgba(34, 197, 94, 0.25)' : 'rgba(234, 179, 8, 0.25)'};
      color: ${isConnected ? '#4ade80' : '#facc15'};
      font-size: 13.5px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .dot {
      width: 9px; height: 9px;
      border-radius: 50%;
      background: ${isConnected ? '#22c55e' : '#eab308'};
      box-shadow: 0 0 10px ${isConnected ? '#22c55e' : '#eab308'};
      display: inline-block;
      margin-right: 8px;
    }
    .metrics { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      border-radius: 8px;
      background: rgba(15, 23, 42, 0.45);
      border: 1px solid rgba(255, 255, 255, 0.04);
      font-size: 13px;
    }
    .label { color: #94a3b8; }
    .val { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; color: #f1f5f9; }
    .btn {
      display: block;
      width: 100%;
      padding: 12px;
      border-radius: 10px;
      background: linear-gradient(135deg, #7c3aed, #4f46e5);
      color: #fff;
      text-decoration: none;
      text-align: center;
      font-weight: 600;
      font-size: 13.5px;
      transition: opacity 0.2s;
      box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);
    }
    .btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="veil"></div>
  <div class="card">
    <div class="brand">
      <div class="icon">🎯</div>
      <div>
        <div class="title">Job Radar OS</div>
        <div class="badge">System Telemetry & Health</div>
      </div>
    </div>

    <div class="status-banner">
      <div>
        <span class="dot"></span>
        <span>${isConnected ? 'All Systems Operational' : 'Database Initializing / Reconnecting'}</span>
      </div>
      <span>${isConnected ? '200 OK' : 'SYNCING'}</span>
    </div>

    <div class="metrics">
      <div class="row">
        <span class="label">Database Connection</span>
        <span class="val" style="color: ${isConnected ? '#4ade80' : '#facc15'}">${isConnected ? 'Connected (TiDB MySQL)' : 'Retrying…'}</span>
      </div>
      <div class="row">
        <span class="label">Uptime</span>
        <span class="val">${uptimeStr}</span>
      </div>
      <div class="row">
        <span class="label">Crawler Engine</span>
        <span class="val" style="color: #a78bfa">Active (12h Sync)</span>
      </div>
      <div class="row">
        <span class="label">ATS Radar Connectors</span>
        <span class="val">79 Configured</span>
      </div>
      <div class="row">
        <span class="label">Environment</span>
        <span class="val">Production</span>
      </div>
    </div>

    <a href="/" class="btn">Open Job Radar Workspace →</a>
  </div>
</body>
</html>`);
  }

  // Return standard JSON for monitoring / Render probes (always HTTP 200 so container isn't restarted in a loop)
  res.status(200).json({
    status: isConnected ? 'ok' : 'initializing',
    db: dbStatus,
    uptime_seconds: uptime,
    timestamp: new Date().toISOString(),
    error: dbError || null
  });
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
  maxAge: '1y',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
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
