const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const Subject = require('../models/Subject');
const User = require('../models/user-model');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');

async function resolveFolderNameForSubject(subjectName) {
  if (!subjectName) return 'unknown';
  const s = String(subjectName);
  if (s.toLowerCase().startsWith('unknown')) return s;
  // If subjectName looks like a Mongo id, use it
  if (/^[0-9a-fA-F]{24}$/.test(s)) return s;
  // try to find a matching user (username, name, email)
  try {
    const u = await User.findOne({
      $or: [
        { username: s },
        { name: s },
        { email: s }
      ]
    }).select('_id').lean();
    if (u && u._id) return String(u._id);
  } catch (e) {
    console.warn('resolveFolderNameForSubject user lookup failed', e);
  }
  return s.replace(/[\/\\]/g, '_');
}

async function saveBufferToSubject(subjectName, buffer, ext = 'png', rawRecognize = null, comprefaceId = null) {
  if (!subjectName) throw new Error('subjectName required');

  const folderName = await resolveFolderNameForSubject(subjectName);

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const shortHash = hash.slice(0, 8);
  const timestamp = Date.now();
  const filename = `${timestamp}__${shortHash}.${ext}`;
  const subjectDir = path.join(UPLOAD_DIR, 'subjects', folderName);
  await fsp.mkdir(subjectDir, { recursive: true });
  const filepath = path.join(subjectDir, filename);
  await fsp.writeFile(filepath, buffer);

  const relPath = path.relative(path.join(__dirname, '..', 'public'), filepath).replace(/\\/g, '/');
  const url = `/static/${relPath}`;
  const size = buffer.length;
  const createdAt = new Date().toISOString();

  const imageRecord = { filename, url, hash, size, source: 'compreface', createdAt };

  const subjDoc = await Subject.findOne({ name: subjectName }).exec();
  if (subjDoc) {
    const exists = subjDoc.images && subjDoc.images.find((i) => i.hash === hash);
    if (!exists) {
      subjDoc.images.push(imageRecord);
      subjDoc.nextSeq = (typeof subjDoc.nextSeq === 'number' ? subjDoc.nextSeq + 1 : 1);
      if (comprefaceId) subjDoc.comprefaceId = comprefaceId;
      await subjDoc.save();
    } else {
      if (comprefaceId && subjDoc.comprefaceId !== comprefaceId) {
        subjDoc.comprefaceId = comprefaceId;
        await subjDoc.save();
      }
    }
    return { image: imageRecord, subject: subjDoc.toObject(), folder: folderName };
  } else {
    const newSubj = new Subject({
      name: subjectName,
      comprefaceId: comprefaceId || undefined,
      images: [imageRecord],
      nextSeq: 1
    });
    await newSubj.save();
    return { image: imageRecord, subject: newSubj.toObject(), folder: folderName };
  }
}

async function findSubjectFileByFilename(filename) {
  const base = path.join(UPLOAD_DIR, 'subjects');
  try {
    const subjects = await fsp.readdir(base, { withFileTypes: true });
    for (const s of subjects) {
      if (!s.isDirectory()) continue;
      const subjectDir = path.join(base, s.name);
      const files = await fsp.readdir(subjectDir, { withFileTypes: true });
      for (const f of files) {
        if (!f.isFile()) continue;
        if (f.name === filename) {
          return { filePath: path.join(subjectDir, f.name), subjectNameDir: s.name };
        }
      }
    }
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('findSubjectFileByFilename error', e);
  }
  return null;
}

async function removeImageFromSubject(subjectName, filename, hash = null) {
  try {
    if (!subjectName) return false;
    if (filename) {
      const res = await Subject.updateOne({ name: subjectName }, { $pull: { images: { filename } } }).exec();
      return !!res;
    }
    if (hash) {
      const res = await Subject.updateOne({ name: subjectName }, { $pull: { images: { hash } } }).exec();
      return !!res;
    }
    return false;
  } catch (e) {
    console.warn('removeImageFromSubject error', e);
    return false;
  }
}

module.exports = { saveBufferToSubject, findSubjectFileByFilename, removeImageFromSubject, resolveFolderNameForSubject };
