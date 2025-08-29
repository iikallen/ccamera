const express = require('express');
const unknownService = require('../services/unknown-service');
const router = express.Router();

// GET /api/compreface/unknowns     ?cameraId=...&unresolvedOnly=true
router.get('/', async (req, res) => {
  try {
    const cameraId = req.query.cameraId;
    const unresolvedOnly = req.query.unresolvedOnly !== 'false';
    const limit = parseInt(req.query.limit || '200', 10);
    const list = await unknownService.listUnknowns({ cameraId, unresolvedOnly, limit });
    return res.json(list);
  } catch (e) {
    console.error('/unknowns GET error', e);
    return res.status(500).json({ error: e.message });
  }
});

// SSE stream
router.get('/stream', (req, res) => {
  try {
    unknownService.registerClient(res);
  } catch (e) {
    console.error('/unknowns/stream error', e);
    res.status(500).end();
  }
});

// GET /api/compreface/unknowns/:id
router.get('/:id', async (req, res) => {
  try {
    const doc = await unknownService.getUnknown(req.params.id);
    if (!doc) return res.status(404).json({ error: 'not found' });
    return res.json(doc);
  } catch (e) {
    console.error('GET /unknowns/:id error', e);
    return res.status(500).json({ error: e.message });
  }
});

// POST /api/compreface/unknowns/:id/resolve  { action: 'enroll'|'ignore'|'delete', subject: 'name' }
router.post('/:id/resolve', async (req, res) => {
  try {
    const id = req.params.id;
    const { action, subject } = req.body;
    const userId = req.user ? (req.user._id || req.user.id) : null;
    if (!['enroll','ignore','delete'].includes(action)) {
      return res.status(400).json({ error: 'invalid action' });
    }

    // resolve in DB
    const result = await unknownService.resolveUnknown(id, { action, userId, subject });
    if (!result) return res.status(404).json({ error: 'not found' });

    // If action === 'enroll' we don't perform enroll here.
    // Client should call existing /compreface/enroll with image (or server can implement enroll pipeline).
    return res.json({ ok: true, result });
  } catch (e) {
    console.error('POST /unknowns/:id/resolve error', e);
    return res.status(500).json({ error: e.message });
  }
});

// DELETE /api/compreface/unknowns/:id  - hard delete
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await unknownService.resolveUnknown(id, { action: 'delete' });
    if (!result) return res.status(404).json({ error: 'not found' });
    return res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /unknowns/:id error', e);
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;