const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

async function writeMetadataFile(dir, filename, meta) {
  const metaPath = path.join(dir, filename + '.json');
  await fsp.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');
  return metaPath;
}

async function readMetadataForFile(filePath, subjectNameDir) {
  const dir = path.dirname(filePath);
  const filename = path.basename(filePath);
  const metaPath = path.join(dir, filename + '.json');
  try {
    const raw = await fsp.readFile(metaPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    const st = await fsp.stat(filePath);
    const relPath = path.relative(PUBLIC_DIR, filePath).replace(/\\/g, '/');
    const url = `/static/${relPath}`;
    const recognized = !!(subjectNameDir && !String(subjectNameDir).toLowerCase().startsWith('unknown'));
    return {
      filename,
      url,
      hash: null,
      size: st.size,
      subjectName: subjectNameDir || null,
      recognized,
      createdAt: st.mtime.toISOString(),
      rawRecognize: null
    };
  }
}

async function safeUnlinkPublic(relOrAbsPath) {
  try {
    const abs = path.isAbsolute(relOrAbsPath) ? relOrAbsPath : path.join(PUBLIC_DIR, relOrAbsPath);
    const norm = path.resolve(abs);
    if (!norm.startsWith(path.resolve(PUBLIC_DIR))) {
      console.warn('safeUnlinkPublic: attempted to unlink outside public', norm);
      return false;
    }
    if (fs.existsSync(norm)) {
      await fsp.unlink(norm);
      return true;
    }
    return false;
  } catch (e) {
    console.warn('safeUnlinkPublic error', e);
    return false;
  }
}

async function safeRemoveMetaForFile(absOrRelPath) {
  try {
    const abs = path.isAbsolute(absOrRelPath) ? absOrRelPath : path.join(PUBLIC_DIR, absOrRelPath);
    const meta = abs + '.json';
    if (meta.startsWith(PUBLIC_DIR) && fs.existsSync(meta)) {
      await fsp.unlink(meta);
      return true;
    }
  } catch (e) {
    // ignore
  }
  return false;
}

module.exports = {
  writeMetadataFile,
  readMetadataForFile,
  safeUnlinkPublic,
  safeRemoveMetaForFile,
  PUBLIC_DIR
};
