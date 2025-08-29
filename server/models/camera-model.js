// server/models/camera-model.js
const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const CameraSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },

  // network / access
  ip: { type: String, required: true },
  user: { type: String, default: '' },
  pass: { type: String, default: '' },

  // ports / urls
  httpPort: { type: Number, default: 80 },
  rtspPort: { type: Number, default: 554 },
  // full RTSP url (optional). If present, will be used as-is.
  rtspUrl: { type: String, default: '' },
  // common hikvision channel notation, e.g. "101"
  rtspChannel: { type: String, default: '101' },

  // behaviour
  enabled: { type: Boolean, default: true },
  pollIntervalSec: { type: Number, default: 10 }, // snapshots interval

  // runtime info
  lastSnapshotAt: { type: Date },
  lastSeen: { type: Date },

}, { timestamps: true });

module.exports = mongoose.models.Camera || model('Camera', CameraSchema);
