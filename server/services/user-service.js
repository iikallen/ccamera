// server/services/user-service.js
const UserModel = require('../models/user-model');
const bcrypt = require('bcrypt');
const uuid = require('uuid');
const mailService = require('./mail-service');
const tokenService = require('./token-service');
const UserDto = require('../dtos/user-dto');
const ApiError = require('../exceptions/api-error');

class UserService {
    async registration(email, password) {
        const candidate = await UserModel.findOne({ email });
        if (candidate) {
            throw ApiError.BadRequest(`Пользователь с почтовым адресом ${email} уже существует`);
        }
        const hashPassword = await bcrypt.hash(password, 3);
        const activationLink = uuid.v4();

        const user = await UserModel.create({ email, password: hashPassword, activationLink, guest: false });
        await mailService.sendActivationMail(email, `${process.env.API_URL}/api/activate/${activationLink}`);

        const userDto = new UserDto(user);
        const tokens = tokenService.generateTokens({ ...userDto });
        await tokenService.saveToken(userDto.id, tokens.refreshToken);

        // add webRTC signals for this user (best-effort)
        try {
          const webrtcService = require('./webrtc-service');
          await webrtcService.addSignalsForUser(userDto.id);
        } catch (e) {
          console.warn('addSignalsForUser failed during registration', e && e.message ? e.message : e);
        }

        return { ...tokens, user: userDto };
    }

    async activate(activationLink) {
        const user = await UserModel.findOne({ activationLink });
        if (!user) {
            throw ApiError.BadRequest('Некорректная ссылка активации');
        }
        user.isActivated = true;
        await user.save();
    }

    async login(email, password) {
        const user = await UserModel.findOne({ email });
        if (!user) {
            throw ApiError.BadRequest('Пользователь с таким email не найден');
        }
        const isPassEquals = await bcrypt.compare(password, user.password);
        if (!isPassEquals) {
            throw ApiError.BadRequest('Неверный пароль');
        }
        const userDto = new UserDto(user);
        const tokens = tokenService.generateTokens({ ...userDto });

        await tokenService.saveToken(userDto.id, tokens.refreshToken);

        // add webRTC signals for this user (best-effort)
        try {
          const webrtcService = require('./webrtc-service');
          await webrtcService.addSignalsForUser(userDto.id);
        } catch (e) {
          console.warn('addSignalsForUser failed during login', e && e.message ? e.message : e);
        }

        return { ...tokens, user: userDto };
    }

    async logout(refreshToken) {
        const token = await tokenService.removeToken(refreshToken);
        return token;
    }

    async refresh(refreshToken) {
        if (!refreshToken) {
            throw ApiError.UnauthorizedError();
        }
        const userData = tokenService.validateRefreshToken(refreshToken);
        const tokenFromDb = await tokenService.findToken(refreshToken);
        if (!userData || !tokenFromDb) {
            throw ApiError.UnauthorizedError();
        }
        const user = await UserModel.findById(userData.id);
        const userDto = new UserDto(user);
        const tokens = tokenService.generateTokens({ ...userDto });

        await tokenService.saveToken(userDto.id, tokens.refreshToken);
        return { ...tokens, user: userDto };
    }

    async getAllUsers() {
        const users = await UserModel.find();
        return users;
    }

    // --- создаём гостевого пользователя и возвращаем токены+user ---
    async guest() {
        const randomId = uuid.v4();
        const guestEmail = `guest-${randomId}@local`;
        const guestUsername = `guest-${randomId.slice(0, 8)}`;
        const hashPassword = await bcrypt.hash(uuid.v4(), 3);

        const user = await UserModel.create({
            email: guestEmail,
            password: hashPassword,
            name: '',
            username: guestUsername,
            guest: true,
            isActivated: false,
            role: 'guest'
        });

        const userDto = new UserDto(user);
        const tokens = tokenService.generateTokens({ ...userDto });
        await tokenService.saveToken(userDto.id, tokens.refreshToken);

        // add webRTC signals for guest user (best-effort)
        try {
          const webrtcService = require('./webrtc-service');
          await webrtcService.addSignalsForUser(userDto.id);
        } catch (e) {
          console.warn('addSignalsForUser failed during guest creation', e && e.message ? e.message : e);
        }

        return { ...tokens, user: userDto };
    }

    // --- совместимость: некоторые места ожидают createGuestTokens ---
    async createGuestTokens() {
      return this.guest();
    }
}

module.exports = new UserService();
