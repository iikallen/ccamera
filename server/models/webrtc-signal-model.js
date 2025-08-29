// server/models/webrtc-signal-model.js
const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const WebRTCSignalSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  producerId: { type: String, required: true, index: true },
  cameraId: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.models.WebRTCSignal || model('WebRTCSignal', WebRTCSignalSchema);
