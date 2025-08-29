const ApiError = require('../exceptions/api-error');
const tokenService = require('../services/token-service');

module.exports = function (req, res, next) {
  try {
    // Попытаемся получить access token из Authorization header
    const authorizationHeader = req.headers.authorization;

    let accessToken;
    if (authorizationHeader && typeof authorizationHeader === 'string') {
      const parts = authorizationHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        accessToken = parts[1];
      }
    }

    // fallback: если access token передали в cookie (не обязателен, но полезно для некоторых конфигураций)
    if (!accessToken && req.cookies && (req.cookies.accessToken || req.cookies.Authorization)) {
      accessToken = req.cookies.accessToken || req.cookies.Authorization;
    }

    if (!accessToken) {
      // явно логируем для отладки — можно убрать/сделать уровень debug в prod
      console.warn('auth-middleware: access token not provided');
      return next(ApiError.UnauthorizedError());
    }

    const userData = tokenService.validateAccessToken(accessToken);
    if (!userData) {
      console.warn('auth-middleware: access token invalid');
      return next(ApiError.UnauthorizedError());
    }

    req.user = userData;
    next();
  } catch (e) {
    console.error('auth-middleware error:', e);
    return next(ApiError.UnauthorizedError());
  }
};
