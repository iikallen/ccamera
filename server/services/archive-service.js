const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const { writeMetadataFile, readMetadataForFile } = require('../utils/file-utils');
const User = require('../models/user-model');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');

async function resolveFolderNameForSubject(subjectName) {
  if (!subjectName) return 'unknown';
  const s = String(subjectName);
  if (s.toLowerCase().startsWith('unknown')) return s;
  // try to find user by username/name/email
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
  // fallback to original subjectName (sanitized)
  return s.replace(/[\/\\]/g, '_');
}

async function listAllArchives() {
  const base = path.join(UPLOAD_DIR, 'compreface', 'archive');
  const results = [];
  try {
    const subjects = await fsp.readdir(base, { withFileTypes: true });
    for (const s of subjects) {
      if (!s.isDirectory()) continue;
      const subjectDir = path.join(base, s.name);
      const files = await fsp.readdir(subjectDir, { withFileTypes: true });
      for (const f of files) {
        if (!f.isFile()) continue;
        const ext = path.extname(f.name).toLowerCase();
        if (ext === '.json') continue;
        const filePath = path.join(subjectDir, f.name);
        const meta = await readMetadataForFile(filePath, s.name);
        results.push(meta);
      }
    }
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('listAllArchives error', e);
  }
  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return results;
}

async function findArchiveFilePathByFilename(filename) {
  const base = path.join(UPLOAD_DIR, 'compreface', 'archive');
  try {
    const subjects = await fsp.readdir(base, { withFileTypes: true });
    for (const s of subjects) {
      if (!s.isDirectory()) continue;
      const subjectDir = path.join(base, s.name);
      const files = await fsp.readdir(subjectDir, { withFileTypes: true });
      for (const f of files) {
        if (!f.isFile()) continue;
        if (f.name === filename) return { filePath: path.join(subjectDir, f.name), subjectNameDir: s.name, subjectDir };
      }
    }
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('findArchiveFilePathByFilename error', e);
  }
  return null;
}

async function saveBufferToArchive(subjectName, buffer, ext = 'png', rawRecognize = null) {
  const folderName = await resolveFolderNameForSubject(subjectName);

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const shortHash = hash.slice(0, 8);
  const timestamp = Date.now();
  const filename = `${timestamp}__${shortHash}.${ext}`;
  const archiveDir = path.join(UPLOAD_DIR, 'compreface', 'archive', folderName);
  await fsp.mkdir(archiveDir, { recursive: true });
  const filepath = path.join(archiveDir, filename);
  await fsp.writeFile(filepath, buffer);

  const relPath = path.relative(path.join(__dirname, '..', 'public'), filepath).replace(/\\/g, '/');
  const url = `/static/${relPath}`;
  const size = buffer.length;
  const createdAt = new Date().toISOString();

  // recognized = subjectName was not unknown*
  const recognized = !(String(subjectName || '').toLowerCase().startsWith('unknown'));

  const meta = {
    filename,
    url,
    hash,
    size,
    subjectName,
    recognized,
    createdAt,
    rawRecognize
  };

  await writeMetadataFile(archiveDir, filename, meta);

  return {
    filename,
    url,
    hash,
    size,
    subjectName,
    createdAt,
    recognized
  };
}

async function updateMetadataForFilename(filename, updates = {}) {
  const found = await findArchiveFilePathByFilename(filename);
  if (!found) return false;
  const { filePath, subjectDir } = found;
  const metaPath = filePath + '.json';
  let meta = {};
  try {
    const raw = await fsp.readFile(metaPath, 'utf8');
    meta = JSON.parse(raw);
  } catch (e) {
    const st = await fsp.stat(filePath);
    const relPath = path.relative(path.join(__dirname, '..', 'public'), filePath).replace(/\\/g, '/');
    meta = {
      filename: path.basename(filePath),
      url: `/static/${relPath}`,
      hash: meta.hash || null,
      size: st.size,
      subjectName: subjectDir,
      recognized: !(String(subjectDir || '').toLowerCase().startsWith('unknown')),
      createdAt: st.mtime.toISOString(),
      rawRecognize: meta.rawRecognize || null
    };
  }
  meta = { ...meta, ...updates };
  await writeMetadataFile(path.dirname(filePath), meta.filename, meta);
  return true;
}

module.exports = { listAllArchives, findArchiveFilePathByFilename, saveBufferToArchive, updateMetadataForFilename };
