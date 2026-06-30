function errorHandler(err, req, res, next) {
  console.error('[Error]', err.message || err);

  const status = err.status || err.statusCode || 500;
  const message = err.expose
    ? err.message
    : 'An unexpected error occurred. Please try again.';

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
