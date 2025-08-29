// server/controllers/compreface-controller.js
const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const fetch = require('node-fetch');
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver');

const {
  listAllArchives,
  findArchiveFilePathByFilename,
  saveBufferToArchive,
  updateMetadataForFilename
} = require('../services/archive-service');

const {
  saveBufferToSubject,
  findSubjectFileByFilename: findSubjectFile,
  removeImageFromSubject
} = require('../services/subject-service');

const { writeMetadataFile, safeUnlinkPublic, safeRemoveMetaForFile } = require('../utils/file-utils');
const { findCandidates, pickBestCandidate, extractComprefaceSubjectId } = require('../utils/compreface-utils');
const { addClient, removeClient, broadcast } = require('../sse/sse');

const Subject = require('../models/Subject');

const COMPREFACE_URL = process.env.COMPREFACE_URL || 'http://localhost:8000';
const RECOGNITION_KEY = process.env.COMPREFACE_RECOGNITION_KEY || process.env.COMPREFACE_KEY || '';
const COMPREFACE_PLUGINS = process.env.COMPREFACE_PLUGINS || 'age,gender';
const MATCH_THRESHOLD = parseFloat(process.env.MATCH_THRESHOLD || '0.75');

const router = express.Router();

// единственное определение multer/upload (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

/* --- вспомогательные роуты / handlers ниже --- */

// GET /archives
router.get('/archives', async (req, res) => {
  try {
    const list = await listAllArchives();
    return res.json(list);
  } catch (err) {
    console.error('GET /archives error', err);
    return res.status(500).json({ error: err.message });
  }
});

// SSE stream
router.get('/archives/stream', (req, res) => {
  res.writeHead(200, {
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache',
    'Content-Type': 'text/event-stream',
    'Access-Control-Allow-Origin': '*'
  });
  res.write('\n');
  addClient(res);
  req.on('close', () => removeClient(res));
});

// DELETE /archive
router.delete('/archive', async (req, res) => {
  const filename = req.query.filename;
  if (!filename) return res.status(400).json({ error: 'filename required' });
  try {
    const found = await findArchiveFilePathByFilename(filename);
    if (found) {
      const { filePath, subjectNameDir } = found;
      const rel = path.relative(path.join(__dirname, '..', 'public'), filePath);
      await safeUnlinkPublic(rel);
      await safeRemoveMetaForFile(filePath);
      if (subjectNameDir) { try { await removeImageFromSubject(subjectNameDir, filename); } catch (e) {} }
      return res.json({ deleted: true, filename });
    }
    const subjFound = await findSubjectFile(filename);
    if (subjFound) {
      const rel = path.relative(path.join(__dirname, '..', 'public'), subjFound.filePath);
      await safeUnlinkPublic(rel);
      await safeRemoveMetaForFile(subjFound.filePath);
      try { await removeImageFromSubject(subjFound.subjectNameDir, filename); } catch (e) {}
      return res.json({ deleted: true, filename, subject: subjFound.subjectNameDir });
    }
    return res.status(404).json({ error: 'file not found' });
  } catch (err) {
    console.error('DELETE /archive error', err);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /image
router.delete('/image', async (req, res) => {
  const filename = req.query.filename;
  const subject = req.query.subject;
  if (!filename) return res.status(400).json({ error: 'filename required' });

  try {
    const reqUser = req.user || {};
    const userIdentifier = String((reqUser.username || reqUser.id || reqUser._id) || '').toLowerCase();

    function isOwnerOfSubject(subjectName) {
      if (!subjectName) return false;
      const s = String(subjectName).toLowerCase();
      return s === userIdentifier;
    }

    if (subject) {
      if (userIdentifier && !isOwnerOfSubject(subject)) {
        return res.status(403).json({ error: 'Not allowed to delete images for this subject' });
      }
      const subjPath = path.join('uploads', 'subjects', String(subject), String(filename));
      const rel = path.relative(path.join(__dirname, '..', 'public'), path.join(__dirname, '..', subjPath));
      const removed = await safeUnlinkPublic(rel);
      await safeRemoveMetaForFile(path.join(__dirname, '..', subjPath));
      await removeImageFromSubject(subject, filename);
      return res.json({ deleted: removed, filename, subject });
    }

    const found = await findArchiveFilePathByFilename(filename);
    if (found) {
      const { filePath, subjectNameDir } = found;
      if (subjectNameDir && userIdentifier && !isOwnerOfSubject(subjectNameDir)) {
        return res.status(403).json({ error: 'Not allowed to delete this file (subject ownership mismatch)' });
      }
      const rel = path.relative(path.join(__dirname, '..', 'public'), filePath);
      await safeUnlinkPublic(rel);
      await safeRemoveMetaForFile(filePath);
      if (subjectNameDir) await removeImageFromSubject(subjectNameDir, filename);
      return res.json({ deleted: true, filename, subject: subjectNameDir || null });
    }

    const subjFound = await findSubjectFile(filename);
    if (subjFound) {
      if (subjFound.subjectNameDir && userIdentifier && !isOwnerOfSubject(subjFound.subjectNameDir)) {
        return res.status(403).json({ error: 'Not allowed to delete this file (subject ownership mismatch)' });
      }
      const rel = path.relative(path.join(__dirname, '..', 'public'), subjFound.filePath);
      await safeUnlinkPublic(rel);
      await safeRemoveMetaForFile(subjFound.filePath);
      await removeImageFromSubject(subjFound.subjectNameDir, filename);
      return res.json({ deleted: true, filename, subject: subjFound.subjectNameDir });
    }

    return res.status(404).json({ error: 'file not found' });
  } catch (err) {
    console.error('DELETE /image error', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /export
router.get('/export', async (req, res) => {
  const date = req.query.date;
  if (!date) return res.status(400).json({ error: 'date param required YYYY-MM-DD' });
  try {
    const all = await listAllArchives();
    const filtered = all.filter(item => {
      const d = new Date(item.createdAt).toISOString().slice(0,10);
      return d === date;
    });

    res.attachment(`snapshots-${date}.zip`);
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => { console.error('archiver error', err); res.status(500).end(); });
    archive.pipe(res);

    for (const item of filtered) {
      const publicPrefix = '/static/';
      if (!item.url || !item.url.startsWith(publicPrefix)) continue;
      const rel = item.url.slice(publicPrefix.length);
      const absPath = path.join(__dirname, '..', 'public', rel);
      const nameInZip = (item.subjectName ? (item.subjectName + '/' ) : '') + item.filename;
      archive.file(absPath, { name: nameInZip });
    }
    await archive.finalize();
  } catch (err) {
    console.error('GET /export error', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /recognize (proxy to CompreFace)
router.post('/recognize', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    const form = new FormData();
    form.append('file', req.file.buffer, { filename: req.file.originalname || 'upload.png', contentType: req.file.mimetype || 'image/png' });
    const url = `${COMPREFACE_URL}/api/v1/recognition/recognize?face_plugins=${encodeURIComponent(COMPREFACE_PLUGINS)}`;
    const resp = await fetch(url, { method: 'POST', headers: { 'x-api-key': RECOGNITION_KEY, ...form.getHeaders() }, body: form });
    let json;
    try { json = await resp.json(); } catch (e) { const text = await resp.text(); return res.status(resp.status).send(text); }
    return res.status(resp.status).json(json);
  } catch (err) {
    console.error('compreface/recognize error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /enroll
router.post('/enroll', upload.single('file'), async (req, res) => {
  try {
    const subject = req.query.subject || req.body.subject;
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    if (!subject) return res.status(400).json({ error: 'subject query param required' });

    const form = new FormData();
    form.append('file', req.file.buffer, { filename: req.file.originalname || 'enroll.png', contentType: req.file.mimetype || 'image/png' });
    const url = `${COMPREFACE_URL}/api/v1/recognition/faces?subject=${encodeURIComponent(subject)}`;
    const resp = await fetch(url, { method: 'POST', headers: { 'x-api-key': RECOGNITION_KEY, ...form.getHeaders() }, body: form });

    let json = null;
    try { json = await resp.json(); } catch (e) { const text = await resp.text(); return res.status(resp.status).send(text); }

    let savedToSubject = null;
    try {
      const ext = (req.file.mimetype && req.file.mimetype.split('/')[1]) || 'png';
      const comprefaceId = extractComprefaceSubjectId(json);
      const saved = await saveBufferToSubject(subject, req.file.buffer, ext, null, comprefaceId);
      savedToSubject = saved;
    } catch (e) { console.warn('save to Subject after enroll failed', e); }

    try {
      const filename = req.file.originalname;
      if (filename) await updateMetadataForFilename(filename, { subjectName: subject, recognized: true });
    } catch (e) { console.warn('metadata update after enroll failed', e); }

    broadcast({ type: 'enroll', subject, savedToSubject });

    return res.status(resp.status).json({ compreface: json, savedToSubject });
  } catch (err) {
    console.error('compreface/enroll error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /subjects/:name
router.get('/subjects/:name', async (req, res) => {
  try {
    const name = req.params.name;
    if (!name) return res.status(400).json({ error: 'name required' });
    const subj = await Subject.findOne({ name }).lean();
    if (!subj) return res.status(404).json({ error: 'not found' });

    const images = (subj.images || []).map((img) => ({
      filename: img.filename,
      url: img.url,
      hash: img.hash,
      size: img.size,
      subjectName: subj.name,
      recognized: true,
      createdAt: img.createdAt ? new Date(img.createdAt).toISOString() : new Date().toISOString(),
      rawRecognize: null
    }));

    return res.json({
      name: subj.name,
      comprefaceId: subj.comprefaceId || null,
      nextSeq: subj.nextSeq || 0,
      createdAt: subj.createdAt ? new Date(subj.createdAt).toISOString() : new Date().toISOString(),
      images
    });
  } catch (err) {
    console.error('GET /subjects/:name error', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /sync
router.post('/sync', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });

    const form = new FormData();
    form.append('file', req.file.buffer, { filename: req.file.originalname || 'upload.png', contentType: req.file.mimetype || 'image/png' });
    const recognizeUrl = `${COMPREFACE_URL}/api/v1/recognition/recognize?face_plugins=${encodeURIComponent(COMPREFACE_PLUGINS)}`;
    const resp = await fetch(recognizeUrl, { method: 'POST', headers: { 'x-api-key': RECOGNITION_KEY, ...form.getHeaders() }, body: form });

    let json;
    try { json = await resp.json(); } catch (e) { const text = await resp.text(); return res.status(resp.status).send(text); }

    const candidates = findCandidates(json);
    const best = pickBestCandidate(candidates);

    let subjectName = null;
    let action = null;
    let matchScore = null;

    if (best && best.score >= MATCH_THRESHOLD) {
      subjectName = best.subject;
      matchScore = best.score;
      action = 'matched';
    } else {
      const unknownDocs = await Subject.find({ name: { $regex: /^unknown\\d+$/i } }).select('name').lean();
      let max = 0;
      unknownDocs.forEach((d) => {
        const m = d.name.match(/^unknown(\\d+)$/i);
        if (m && m[1]) {
          const n = parseInt(m[1], 10);
          if (!isNaN(n) && n > max) max = n;
        }
      });
      const next = max + 1;
      subjectName = `unknown${next}`;
      action = 'created_unknown_local_only';
    }

    const ext = (req.file.mimetype && req.file.mimetype.split('/')[1]) || 'png';
    const savedArchive = await saveBufferToArchive(subjectName, req.file.buffer, ext, json);

    const doEnroll = String(req.query.enroll || '').toLowerCase() === 'true';
    let enrollJson = null;
    let savedToSubject = null;
    if (doEnroll) {
      const enrollForm = new FormData();
      enrollForm.append('file', req.file.buffer, { filename: savedArchive.filename, contentType: req.file.mimetype || 'image/png' });
      const enrollUrl = `${COMPREFACE_URL}/api/v1/recognition/faces?subject=${encodeURIComponent(subjectName)}`;
      const enrollResp = await fetch(enrollUrl, { method: 'POST', headers: { 'x-api-key': RECOGNITION_KEY, ...enrollForm.getHeaders() }, body: enrollForm });

      try { enrollJson = await enrollResp.json(); action = action === 'matched' ? 'matched_and_enrolled' : 'enrolled'; } catch (e) { console.warn('enroll parse error', e); }

      try {
        const comprefaceId = extractComprefaceSubjectId(enrollJson);
        savedToSubject = await saveBufferToSubject(subjectName, req.file.buffer, ext, json, comprefaceId);
      } catch (e) { console.warn('saveBufferToSubject in sync enroll failed', e); }
    }

    broadcast({ type: 'archive', meta: savedArchive });

    return res.json({ action, subject: subjectName, matchScore, savedArchive, enrollResponse: enrollJson, savedToSubject, rawRecognize: json });
  } catch (err) {
    console.error('compreface/sync error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
