const multer = require('multer');
const path = require('path');
const fs = require('fs');

const baseUploads = path.join(__dirname, '..', 'public', 'uploads', 'avatars');

fs.mkdirSync(baseUploads, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
      const userId =
        (req.user && (req.user.id || req.user._id)) ||
        (req.body && req.body.userId) ||
        'anonymous';
      const uid = String(userId);
      const userDir = path.join(baseUploads, uid);
      fs.mkdirSync(userDir, { recursive: true });
      cb(null, userDir);
    } catch (e) {
      cb(e);
    }
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  if (!file.mimetype || !file.mimetype.startsWith('image/')) {
    cb(new Error('Только изображения разрешены'), false);
  } else {
    cb(null, true);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = upload;
