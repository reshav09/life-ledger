/**
 * Centralized Express error-handling middleware.
 * Catches any unhandled errors from route handlers and returns a consistent JSON payload.
 */
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const reqId = req.id || 'unknown';

  // Log error details for 500s
  if (status >= 500) {
    console.error(`[${new Date().toISOString()}] UNHANDLED ERROR (${reqId}):`, err.stack || err);
  }

  // Hide internal stack traces from client in production
  const message = (status >= 500 && process.env.NODE_ENV === 'production')
    ? 'Internal server error'
    : (err.message || 'Something went wrong');

  res.status(status).json({
    error: message,
    code: err.code || (status === 400 ? 'BAD_REQUEST' : status === 401 ? 'UNAUTHORIZED' : status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR'),
    request_id: reqId,
    ...(err.details ? { details: err.details } : {})
  });
}

module.exports = errorHandler;
