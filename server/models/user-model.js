// server/models/user-model.js
const { Schema, model } = require('mongoose');

const UserSchema = new Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  isActivated: { type: Boolean, default: false },
  activationLink: { type: String },
  name: { type: String, default: '' },
  username: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
  avatar: { type: String, default: '' },
  guest: { type: Boolean, default: false },
  role: { type: String, default: '' },
}, { timestamps: true });

module.exports = model('User', UserSchema);
