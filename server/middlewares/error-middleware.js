// server/middlewares/error-middleware.js
const ApiError = require('../exceptions/api-error');

module.exports = function (err, req, res, next) {
  if (err && err.stack) console.error(err.stack);
  console.error('Request:', req.method, req.originalUrl);

  if (err instanceof ApiError) {
    return res.status(err.status).json({ message: err.message, errors: err.errors });
  }

  // в development возвращаем больше данных (удали в проде)
  if (process.env.NODE_ENV !== 'production') {
    return res.status(500).json({
      message: err?.message || 'Непредвиденная ошибка',
      stack: err?.stack,
    });
  }

  return res.status(500).json({ message: 'Непредвиденная ошибка' });
};
