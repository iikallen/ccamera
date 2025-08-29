// server/services/webrtc-service.js
const WebRTCSignal = require('../models/webrtc-signal-model');
const mediasoupManager = require('./mediasoup-manager');

async function addSignalsForUser(userId) {
  try {
    const producers = mediasoupManager.listProducers();
    if (!producers || !producers.length) return 0;
    const docs = producers.map(p => ({
      user: userId,
      producerId: p.producerId,
      cameraId: p.cameraId || '',
      createdAt: new Date()
    }));
    // insertMany will create documents; ignore duplicates if present
    await WebRTCSignal.insertMany(docs);
    return docs.length;
  } catch (e) {
    console.warn('webrtc-service.addSignalsForUser error', e);
    return 0;
  }
}

module.exports = { addSignalsForUser };
