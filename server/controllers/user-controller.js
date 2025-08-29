// server/controllers/user-controller.js
const userService = require('../services/user-service');
const { validationResult } = require('express-validator');
const ApiError = require('../exceptions/api-error');
const User = require('../models/user-model');
const path = require('path');
const fs = require('fs');

const isProd = process.env.NODE_ENV === 'production';
const forceCookieSecure = !(process.env.FORCE_COOKIE_SECURE === 'false' || process.env.FORCE_COOKIE_SECURE === '0');

// helper: возвращает опции cookie для установки
function buildCookieOptions() {
  return {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    path: '/',
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd ? forceCookieSecure : false,
    // domain: process.env.COOKIE_DOMAIN || undefined,
  };
}

// helper: опции для удаления cookie (clear)
function buildCookieClearOptions() {
  return {
    // чтобы корректно удалить cookie, используем тот же path/sameSite/secure/httpOnly
    ...buildCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  };
}

class UserController {
  async registration(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(ApiError.BadRequest('Ошибка при валидации', errors.array()));
      }
      const { email, password } = req.body;
      const userData = await userService.registration(email, password);

      res.cookie('refreshToken', userData.refreshToken, buildCookieOptions());
      return res.json(userData);
    } catch (e) {
      next(e);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const userData = await userService.login(email, password);

      res.cookie('refreshToken', userData.refreshToken, buildCookieOptions());
      return res.json(userData);
    } catch (e) {
      next(e);
    }
  }

  async logout(req, res, next) {
    try {
      // достаём refreshToken из cookie (сервер ожидает его там)
      const { refreshToken } = req.cookies;
      // удаляем token из БД (если есть)
      await userService.logout(refreshToken);

      // очищаем старую cookie
      res.clearCookie('refreshToken', buildCookieClearOptions());

      // создаём guest-токены и ставим гостевую refresh cookie, возвращаем guest user
      try {
        const guestData = await userService.createGuestTokens(); // теперь есть
        res.cookie('refreshToken', guestData.refreshToken, buildCookieOptions());
        return res.json(guestData);
      } catch (guestErr) {
        // если не удалось создать guest — всё равно вернуть ok
        return res.json({ ok: true });
      }
    } catch (e) {
      next(e);
    }
  }

  async activate(req, res, next) {
    try {
      const activationLink = req.params.link;
      await userService.activate(activationLink);
      return res.redirect(process.env.CLIENT_URL || '/');
    } catch (e) {
      next(e);
    }
  }

  async refresh(req, res, next) {
    try {
      // console.log('refresh: req.cookies =', req.cookies);
      const { refreshToken } = req.cookies;
      const userData = await userService.refresh(refreshToken);

      res.cookie('refreshToken', userData.refreshToken, buildCookieOptions());
      return res.json(userData);
    } catch (e) {
      next(e);
    }
  }

  async guest(req, res, next) {
    try {
      const userData = await userService.guest();
      res.cookie('refreshToken', userData.refreshToken, buildCookieOptions());
      return res.json(userData);
    } catch (e) {
      next(e);
    }
  }

  async getUsers(req, res, next) {
    try {
      const users = await userService.getAllUsers();
      return res.json(users);
    } catch (e) {
      next(e);
    }
  }

  async getMe(req, res, next) {
    try {
      const reqUser = req.user;
      if (!reqUser) {
        return res.status(401).json({ message: 'Неавторизованный' });
      }

      let user;
      if (reqUser._id || reqUser.id) {
        const id = reqUser._id ?? reqUser.id;
        user = await User.findById(id).lean();
      } else {
        user = reqUser;
      }

      if (!user) {
        return res.status(404).json({ message: 'Пользователь не найден' });
      }

      let avatarUrl = '';
      if (user.avatar) {
        const base = process.env.APP_BASE_URL || process.env.API_URL || process.env.CLIENT_URL || '';
        const version = user.updatedAt ? new Date(user.updatedAt).getTime() : Date.now();
        avatarUrl = `${base.replace(/\/$/, '')}/static/${String(user.avatar).replace(/^\/+/, '')}?v=${version}`;
      }

      return res.json({
        id: user._id,
        email: user.email,
        name: user.name || '',
        username: user.username || '',
        avatar: avatarUrl,
        isActivated: user.isActivated,
        guest: Boolean(user.guest ?? false),
        role: user.role ?? '',
      });
    } catch (e) {
      next(e);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const reqUser = req.user;
      if (!reqUser) return res.status(401).json({ message: 'Неавторизованный' });

      const userId = reqUser._id ?? reqUser.id;
      if (!userId) return res.status(401).json({ message: 'Неавторизованный' });

      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

      // handle name
      if (typeof req.body.name === 'string') {
        user.name = req.body.name.trim();
      }

      // handle username (check uniqueness)
      if (typeof req.body.username === 'string') {
        const newUsername = req.body.username.trim();
        if (newUsername && newUsername !== user.username) {
          const existing = await User.findOne({ username: newUsername });
          if (existing && String(existing._id) !== String(userId)) {
            return res.status(400).json({ message: 'Username уже занят' });
          }
          user.username = newUsername;
        }
      }

      // handle avatar file saved by multer into public/uploads/avatars/<userId>/
      if (req.file && (req.file.path || req.file.filename)) {
        try {
          const publicDir = path.join(__dirname, '..', 'public');

          // resolve actual saved path (multer provides req.file.path)
          let filePath =
            req.file.path ||
            (req.file.destination && path.join(req.file.destination, req.file.filename)) ||
            null;

          if (!filePath) {
            console.warn('updateProfile: req.file has no path/destination+filename; skipping file handling');
          } else {
            // compute relative path from publicDir
            let rel = path.relative(publicDir, filePath).replace(/\\/g, '/');
            if (!rel || rel.startsWith('..')) {
              // fallback: place under uploads/avatars/<userId>/<filename>
              const filename = req.file.filename || path.basename(filePath);
              rel = path.posix.join('uploads', 'avatars', String(userId), filename);
            }

            // remove previous avatar file if different
            try {
              if (user.avatar && typeof user.avatar === 'string' && user.avatar.trim() !== '') {
                const prevRel = user.avatar.replace(/^\/+/, '');
                const prevFull = path.join(publicDir, prevRel);
                const newFull = path.join(publicDir, rel);
                if (prevFull.startsWith(publicDir) && fs.existsSync(prevFull)) {
                  if (path.resolve(prevFull) !== path.resolve(newFull)) {
                    try {
                      fs.unlinkSync(prevFull);
                      const prevMeta = prevFull + '.json';
                      if (fs.existsSync(prevMeta)) {
                        try { fs.unlinkSync(prevMeta); } catch {}
                      }
                    } catch (e) {
                      console.warn('updateProfile: failed to remove previous avatar', e);
                    }
                  }
                }
              }
            } catch (e) {
              console.warn('updateProfile: error while removing previous avatar', e);
            }

            user.avatar = rel;
          }
        } catch (e) {
          console.warn('updateProfile: file handling error', e);
        }
      }

      await user.save();

      const base = process.env.APP_BASE_URL || process.env.API_URL || process.env.CLIENT_URL || '';
      const version = user.updatedAt ? new Date(user.updatedAt).getTime() : Date.now();
      const avatarUrl = user.avatar ? `${base.replace(/\/$/, '')}/static/${String(user.avatar).replace(/^\/+/, '')}?v=${version}` : '';

      return res.json({
        id: user._id,
        email: user.email,
        name: user.name || '',
        username: user.username || '',
        avatar: avatarUrl,
        isActivated: user.isActivated,
        guest: Boolean(user.guest ?? false),
        role: user.role ?? '',
      });
    } catch (e) {
      next(e);
    }
  }
}

module.exports = new UserController();
