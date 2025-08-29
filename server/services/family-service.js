const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const fetch = require('node-fetch');

const FamilyMember = require('../models/FamilyMember');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'family');

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

function hashBuffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function createMember(userId, name, relation = 'other') {
  const doc = new FamilyMember({ user: userId, name, relation });
  await doc.save();
  return doc.toObject();
}

async function listMembersByUser(userId) {
  return FamilyMember.find({ user: userId }).lean();
}

async function removeMember(memberId) {
  const m = await FamilyMember.findById(memberId);
  if (!m) return false;

  try {
    const memberDir = path.join(UPLOAD_DIR, String(m.user), String(m._id));
    if (fs.existsSync(memberDir)) {
      const files = await fsp.readdir(memberDir);
      for (const f of files) {
        try { await fsp.unlink(path.join(memberDir, f)); } catch {}
      }
      try { await fsp.rmdir(memberDir); } catch {}
    }
  } catch (e) {
    console.warn('removeMember: cleanup failed', e);
  }

  await FamilyMember.deleteOne({ _id: memberId });
  return true;
}

/**
 * Save photo buffer to public/uploads/family/<userId>/<memberId>/
 * Optionally enroll to CompreFace if enroll === true. Subject used: `${userId}_${memberId}`
 */
async function addPhotoToMember(memberId, buffer, originalname = 'photo.png', mimetype = 'image/png', enroll = false) {
  const member = await FamilyMember.findById(memberId);
  if (!member) throw new Error('member not found');

  const userId = String(member.user);
  const memberDir = path.join(UPLOAD_DIR, userId, String(memberId));
  await ensureDir(memberDir);

  const ext = path.extname(originalname) || (mimetype && mimetype.split('/')[1] ? '.' + mimetype.split('/')[1] : '.png');
  const hash = hashBuffer(buffer);
  const short = hash.slice(0, 8);
  const filename = `${Date.now()}__${short}${ext}`;
  const filepath = path.join(memberDir, filename);
  await fsp.writeFile(filepath, buffer);

  const rel = path.relative(path.join(__dirname, '..', 'public'), filepath).replace(/\\/g, '/');
  const url = `/static/${rel}`;
  const size = buffer.length;
  const createdAt = new Date().toISOString();

  const photoRecord = { filename, url, hash, size, createdAt };

  member.photos.push(photoRecord);
  await member.save();

  let enrollResp = null;
  if (enroll) {
    try {
      const COMPREFACE_URL = process.env.COMPREFACE_URL || 'http://localhost:8000';
      const KEY = process.env.COMPREFACE_RECOGNITION_KEY || process.env.COMPREFACE_KEY || '';
      const subject = `${userId}_${memberId}`;
      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', buffer, { filename, contentType: mimetype });
      const enrollUrl = `${COMPREFACE_URL}/api/v1/recognition/faces?subject=${encodeURIComponent(subject)}`;
      const resp = await fetch(enrollUrl, { method: 'POST', headers: { 'x-api-key': KEY, ...form.getHeaders() }, body: form });
      enrollResp = await resp.json().catch(()=>null);
    } catch (e) {
      console.warn('family-service enroll failed', e);
    }
  }

  return { photo: photoRecord, enrollResp };
}

async function removePhoto(memberId, filename) {
  const member = await FamilyMember.findById(memberId);
  if (!member) return false;
  const before = member.photos.length;
  member.photos = member.photos.filter(p => p.filename !== filename);
  if (member.photos.length === before) return false;
  await member.save();

  const userId = String(member.user);
  const filepath = path.join(UPLOAD_DIR, userId, String(memberId), filename);
  try { if (fs.existsSync(filepath)) await fsp.unlink(filepath); } catch (e) { /* ignore */ }
  return true;
}

module.exports = {
  createMember,
  listMembersByUser,
  removeMember,
  addPhotoToMember,
  removePhoto
};
