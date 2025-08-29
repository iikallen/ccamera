const { Schema, model } = require('mongoose');

const TokenSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  refreshToken: { type: String, required: true, index: true },
  isGuest: { type: Boolean, default: false },
  guestId: { type: String, default: '' }, // для гостей: guest-UUID
  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = model('Token', TokenSchema);
