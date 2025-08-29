const path = require('path');

function buildPublicStaticUrl(relPath) {
  const APP_BASE_URL = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
  const clean = (p) => p.replace(/^\/+/, '');
  if (!APP_BASE_URL) {
    return `/static/${clean(relPath)}`;
  }
  return `${APP_BASE_URL}/static/${clean(relPath)}`;
}

module.exports = { buildPublicStaticUrl };