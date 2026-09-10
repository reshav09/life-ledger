const crypto = require('crypto');

/**
 * Lightweight structured request logger with response time and trace IDs.
 * Outputs clean, parseable JSON or human-readable format depending on environment.
 */
function requestLogger(req, res, next) {
  const reqId = req.headers['x-request-id'] || crypto.randomUUID().slice(0, 8);
  req.id = reqId;
  res.setHeader('X-Request-ID', reqId);

  const start = process.hrtime();

  res.on('finish', () => {
    // Skip noisy healthcheck logs in production
    if (req.originalUrl === '/api/health' && res.statusCode === 200) return;

    const [secs, nanosecs] = process.hrtime(start);
    const durationMs = (secs * 1000 + nanosecs / 1e6).toFixed(2);

    const logEntry = {
      time: new Date().toISOString(),
      id: reqId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration_ms: Number(durationMs),
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress
    };

    if (res.statusCode >= 500) {
      console.error(`[${logEntry.time}] ERROR ${logEntry.id} ${logEntry.method} ${logEntry.url} ${logEntry.status} ${logEntry.duration_ms}ms`);
    } else if (res.statusCode >= 400) {
      console.warn(`[${logEntry.time}] WARN  ${logEntry.id} ${logEntry.method} ${logEntry.url} ${logEntry.status} ${logEntry.duration_ms}ms`);
    } else {
      console.log(`[${logEntry.time}] INFO  ${logEntry.id} ${logEntry.method} ${logEntry.url} ${logEntry.status} ${logEntry.duration_ms}ms`);
    }
  });

  next();
}

module.exports = requestLogger;
