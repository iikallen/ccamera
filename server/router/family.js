const express = require('express');
const multer = require('multer');
const router = express.Router();
const familyService = require('../services/family-service');

const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/family
 * body: { userId, name, relation? }
 */
router.post('/', async (req, res) => {
  try {
    const { userId, name, relation } = req.body;
    if (!userId || !name) return res.status(400).json({ error: 'userId and name required' });
    const rel = relation || 'other';
    const created = await familyService.createMember(userId, name, rel);
    return res.json(created);
  } catch (e) {
    console.error('POST /api/family error', e);
    return res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/family/:userId
 * list members for user
 */
router.get('/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const list = await familyService.listMembersByUser(userId);
    return res.json(list);
  } catch (e) {
    console.error('GET /api/family/:userId error', e);
    return res.status(500).json({ error: e.message });
  }
});

/**
 * DELETE /api/family/:id
 * delete member
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const ok = await familyService.removeMember(id);
    return res.json({ deleted: ok });
  } catch (e) {
    console.error('DELETE /api/family/:id error', e);
    return res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/family/:id/photo?enroll=true
 * upload single photo for member
 */
router.post('/:id/photo', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file required' });
    const enroll = String(req.query.enroll || '').toLowerCase() === 'true';
    const result = await familyService.addPhotoToMember(req.params.id, req.file.buffer, req.file.originalname, req.file.mimetype, enroll);
    return res.json(result);
  } catch (e) {
    console.error('POST /api/family/:id/photo error', e);
    return res.status(500).json({ error: e.message });
  }
});

/**
 * DELETE /api/family/:id/photo?filename=...
 */
router.delete('/:id/photo', async (req, res) => {
  try {
    const id = req.params.id;
    const filename = req.query.filename;
    if (!filename) return res.status(400).json({ error: 'filename required' });
    const ok = await familyService.removePhoto(id, filename);
    return res.json({ deleted: ok });
  } catch (e) {
    console.error('DELETE /api/family/:id/photo error', e);
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
