function errorHandler(err, req, res, next) {
  console.error(err);
  if (res.headersSent) return next(err);
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  res.status(status).json({ success: false, message: err.message || 'Internal server error' });
}

module.exports = errorHandler;
