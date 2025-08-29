// server/services/token-service.js
const jwt = require('jsonwebtoken');
const tokenModel = require('../models/token-model');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

class TokenService {
  generateTokens(payload) {
    // payload может содержать guest:true и guestId или обычный user fields
    const accessToken = jwt.sign(payload, ACCESS_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: '30d' });
    return { accessToken, refreshToken };
  }

  validateAccessToken(token) {
    try {
      const data = jwt.verify(token, ACCESS_SECRET);
      return data;
    } catch (e) {
      return null;
    }
  }

  validateRefreshToken(token) {
    try {
      const data = jwt.verify(token, REFRESH_SECRET);
      return data;
    } catch (e) {
      return null;
    }
  }

  async saveToken(userId, refreshToken, { isGuest = false, guestId = '' } = {}) {
    // сохраняем/обновляем запись. Для гостей userId должен быть null.
    if (!refreshToken) throw new Error('refreshToken required');
    let tokenDoc;
    if (isGuest && guestId) {
      // для гостей создаём новую запись (позволим несколько гостевых записей)
      tokenDoc = await tokenModel.create({ user: null, refreshToken, isGuest: true, guestId });
      return tokenDoc;
    }

    // для обычных пользователей — обновляем запись по userId
    tokenDoc = await tokenModel.findOne({ user: userId });
    if (tokenDoc) {
      tokenDoc.refreshToken = refreshToken;
      tokenDoc.isGuest = false;
      tokenDoc.guestId = '';
      await tokenDoc.save();
      return tokenDoc;
    }
    tokenDoc = await tokenModel.create({ user: userId, refreshToken, isGuest: false, guestId: '' });
    return tokenDoc;
  }

  async removeToken(refreshToken) {
    if (!refreshToken) return null;
    return tokenModel.deleteOne({ refreshToken });
  }

  async findToken(refreshToken) {
    if (!refreshToken) return null;
    return tokenModel.findOne({ refreshToken }).lean();
  }

  async findTokenByGuestId(guestId) {
    if (!guestId) return null;
    return tokenModel.findOne({ guestId }).lean();
  }

  // опционально: удалять старые гостевые токены
  async cleanupOldGuestTokens(days = 30) {
    const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000);
    return tokenModel.deleteMany({ isGuest: true, createdAt: { $lt: cutoff } });
  }
}

module.exports = new TokenService();
