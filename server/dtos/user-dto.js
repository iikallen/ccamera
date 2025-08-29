module.exports = class UserDto {
  email;
  id;
  isActivated;
  name;
  username;
  avatar;
  guest;
  role;

  constructor(model = {}) {
    this.email = model.email ?? '';
    this.id = model._id ? String(model._id) : (model.id ? String(model.id) : '');
    this.isActivated = Boolean(model.isActivated ?? false);
    this.name = model.name ?? '';

    this.username = model.username ? String(model.username).trim().toLowerCase() : '';

    const avatarVal = model.avatar ?? '';
    if (avatarVal) {
      const isAbsolute = /^https?:\/\//i.test(String(avatarVal));
      if (isAbsolute) {
        this.avatar = String(avatarVal);
      } else {
        const base = process.env.APP_BASE_URL || process.env.API_URL || process.env.CLIENT_URL || '';
        const version = model.updatedAt ? new Date(model.updatedAt).getTime() : Date.now();
        this.avatar = `${base.replace(/\/$/, '')}/static/${String(avatarVal).replace(/^\/+/, '')}?v=${version}`;
      }
    } else {
      this.avatar = '';
    }

    this.guest = Boolean(model.guest ?? false);
    this.role = model.role ?? '';
  }
};
