// server/router/cameras.js
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const Camera = require('../models/camera-model');
const cameraManager = require('../services/camera-manager'); // startCamera, stopCamera, startAllFromDb, cameras map

const router = express.Router();

// helper: build snapshot folder path for a camera id
function snapDirFor(cameraId) {
  return path.join(__dirname, '..', 'public', 'uploads', 'cameras', String(cameraId));
}

// helper: build HLS index path and public url
function hlsIndexPathFor(cameraId) {
  return path.join(__dirname, '..', 'public', 'hls', String(cameraId), 'index.m3u8');
}
function hlsPublicUrlFor(req, cameraId) {
  return `${req.protocol}://${req.get('host')}/hls/${encodeURIComponent(cameraId)}/index.m3u8`;
}

/**
 * GET /api/cameras
 * list cameras
 */
router.get('/', async (req, res, next) => {
  try {
    const list = await Camera.find().sort({ createdAt: -1 }).lean();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/cameras
 * create camera
 * body: { name, ip, user, pass, httpPort, rtspPort, rtspChannel, rtspUrl, pollIntervalSec, enabled }
 */
router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.name || !body.ip) {
      return res.status(400).json({ error: 'name and ip required' });
    }
    const doc = await Camera.create({
      name: body.name,
      description: body.description || '',
      ip: body.ip,
      user: body.user || '',
      pass: body.pass || '',
      httpPort: body.httpPort || 80,
      rtspPort: body.rtspPort || 554,
      rtspUrl: body.rtspUrl || '',
      rtspChannel: body.rtspChannel || '101',
      pollIntervalSec: Number(body.pollIntervalSec) || 10,
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
    });

    // if enabled -> start camera manager for it
    try {
      if (doc.enabled && cameraManager && typeof cameraManager.startCamera === 'function') {
        // pass lean object or mongoose doc; manager expects camDoc._id etc.
        await cameraManager.startCamera(doc);
      }
    } catch (e) {
      console.warn('camera start on create failed', e && e.message ? e.message : e);
    }

    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/cameras/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const doc = await Camera.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/cameras/:id
 * update camera; if enabled toggled -> start/stop manager accordingly
 */
router.put('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const update = req.body || {};
    const prev = await Camera.findById(id).exec();
    if (!prev) return res.status(404).json({ error: 'not found' });

    const updated = await Camera.findByIdAndUpdate(id, update, { new: true }).lean();

    // if enabled changed -> start/stop camera manager accordingly
    const wasEnabled = Boolean(prev.enabled);
    const nowEnabled = Boolean(updated.enabled);
    try {
      if (!wasEnabled && nowEnabled) {
        if (cameraManager && typeof cameraManager.startCamera === 'function') await cameraManager.startCamera(updated);
      }
      if (wasEnabled && !nowEnabled) {
        if (cameraManager && typeof cameraManager.stopCamera === 'function') await cameraManager.stopCamera(id);
      }
    } catch (e) {
      console.warn('camera start/stop on update failed', e && e.message ? e.message : e);
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/cameras/:id
 * stop manager and remove the camera record and optionally remove HLS/snap dirs
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const doc = await Camera.findById(id).lean();
    if (!doc) return res.status(404).json({ error: 'not found' });

    // stop ffmpeg / snapshot loop
    try {
      if (cameraManager && typeof cameraManager.stopCamera === 'function') await cameraManager.stopCamera(id);
    } catch (e) {
      console.warn('cameraManager.stopCamera error', e && e.message ? e.message : e);
    }

    // remove db doc
    await Camera.findByIdAndDelete(id).exec();

    // remove HLS and snapshot directories (best-effort)
    try {
      const hlsDir = path.join(__dirname, '..', 'public', 'hls', String(id));
      const snapDir = snapDirFor(id);
      if (fsSync.existsSync(hlsDir)) await fs.rmdir(hlsDir, { recursive: true });
      if (fsSync.existsSync(snapDir)) await fs.rmdir(snapDir, { recursive: true });
    } catch (e) {
      // ignore removal errors
      console.warn('failed to remove camera files', e && e.message ? e.message : e);
    }

    res.json({ deleted: true, id });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/cameras/:id/snapshot
 * returns latest snapshot JPG for this camera (saved by camera-manager).
 */
router.get('/:id/snapshot', async (req, res, next) => {
  try {
    const id = req.params.id;
    const dir = snapDirFor(id);
    if (!fsSync.existsSync(dir)) return res.status(404).json({ error: 'no snapshots' });

    const files = await fs.readdir(dir);
    // filter jpg/jpeg/png and sort by timestamp descending (files named like TIMESTAMP.jpg in manager)
    const imgs = files.filter(f => /\.(jpe?g|png)$/i.test(f));
    if (!imgs || !imgs.length) return res.status(404).json({ error: 'no snapshots' });

    // pick newest by file mtime (safer)
    let newest = null;
    let newestT = 0;
    for (const f of imgs) {
      try {
        const st = await fs.stat(path.join(dir, f));
        const t = st.mtimeMs || st.ctimeMs || 0;
        if (t > newestT) {
          newestT = t;
          newest = f;
        }
      } catch (e) { /* ignore */ }
    }

    if (!newest) newest = imgs.sort().reverse()[0];
    const filePath = path.join(dir, newest);

    // stream file
    return res.sendFile(filePath, { headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } }, (err) => {
      if (err) next(err);
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/cameras/:id/stream
 * returns JSON with public HLS url (or redirect). Useful to check whether HLS exists.
 */
router.get('/:id/stream', async (req, res, next) => {
  try {
    const id = req.params.id;
    const idx = hlsIndexPathFor(id);
    if (!fsSync.existsSync(idx)) {
      // still return expected URL (maybe ffmpeg hasn't created files yet)
      return res.json({ url: hlsPublicUrlFor(req, id), exists: false });
    }
    return res.json({ url: hlsPublicUrlFor(req, id), exists: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/cameras/:id/start
 * POST /api/cameras/:id/stop
 * manual control
 */
router.post('/:id/start', async (req, res, next) => {
  try {
    const id = req.params.id;
    const doc = await Camera.findById(id).lean();
    if (!doc) return res.status(404).json({ error: 'not found' });
    if (cameraManager && typeof cameraManager.startCamera === 'function') {
      await cameraManager.startCamera(doc);
    }
    // mark enabled
    await Camera.findByIdAndUpdate(id, { enabled: true }).exec();
    res.json({ started: true, id });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/stop', async (req, res, next) => {
  try {
    const id = req.params.id;
    if (cameraManager && typeof cameraManager.stopCamera === 'function') {
      await cameraManager.stopCamera(id);
    }
    await Camera.findByIdAndUpdate(id, { enabled: false }).exec();
    res.json({ stopped: true, id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
