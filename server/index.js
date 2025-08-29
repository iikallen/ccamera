require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const path = require('path');

const errorMiddleware = require('./middlewares/error-middleware');

// routers (best-effort require)
let authRouter = null;
try { authRouter = require('./router'); } catch (e) { console.error('router/index not found', e); }

let familyRouter = null;
let camerasRouter = null;
let comprefaceRouter = null;
try { familyRouter = require('./router/family'); } catch (e) { console.error('router/family not found', e); }
try { camerasRouter = require('./router/cameras'); } catch (e) { console.error('router/cameras not found', e); }
try { comprefaceRouter = require('./router/compreface'); } catch (e) { console.error('router/compreface not found', e); }

// services
let cameraManager = null;
try { cameraManager = require('./services/camera-manager'); } catch (e) { console.warn('camera-manager not found — camera features disabled'); cameraManager = null; }

let mediasoupManager = null;
let initSocket = null;
try {
  mediasoupManager = require('./services/mediasoup-manager');
} catch (e) {
  console.warn('mediasoup-manager not found, SFU features disabled');
}
try {
  initSocket = require('./ws/webrtc-socket');
} catch (e) {
  console.warn('webrtc-socket not found, socket.io features disabled');
}

const PORT = parseInt(process.env.PORT, 10) || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

const app = express();

if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin === CLIENT_URL) return callback(null, true);
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Range', 'X-Requested-With'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: 0 }));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'), { maxAge: 0 }));
app.use('/hls', express.static(path.join(__dirname, 'public', 'hls'), {
  setHeaders: (res, filePath) => {
    res.setHeader('Access-Control-Allow-Origin', CLIENT_URL);
    res.setHeader('Access-Control-Allow-Headers', 'Range,Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
    if (filePath.endsWith('.m3u8')) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (filePath.endsWith('.ts')) {
      res.setHeader('Content-Type', 'video/mp2t');
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
  maxAge: 0
}));

if (authRouter) {
  app.use('/api', authRouter);
  app.use('/api/auth', authRouter);
  console.log('Auth router mounted at /api and /api/auth');
} else {
  console.warn('Auth router not mounted (router/index.js not found)');
}
if (familyRouter) app.use('/api/family', familyRouter);
if (camerasRouter) app.use('/api/cameras', camerasRouter);
if (comprefaceRouter) app.use('/api/compreface', comprefaceRouter);

app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use(errorMiddleware);

const server = http.createServer(app);

const startMediasoupIfNeeded = async () => {
  if (mediasoupManager && typeof mediasoupManager.start === 'function') {
    try {
      await mediasoupManager.start();
      console.log('✅ mediasoupManager started');
    } catch (e) {
      console.warn('mediasoupManager.start failed:', e);
      throw e;
    }
  } else {
    console.log('⚠️ mediasoupManager not found, skipping SFU');
  }
};

const start = async () => {
  const mongoUrl = process.env.DB_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/project-camera';
  try {
    await mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ MongoDB connected');

    await startMediasoupIfNeeded();

    // init socket and pass mediasoupManager explicitly
    if (typeof initSocket === 'function') {
      try {
        // initSocket returns the io instance
        const io = initSocket(server, mediasoupManager);
        global.io = io;
        console.log('✅ Socket.IO initialized');
      } catch (e) {
        console.warn('initSocket failed to initialize socket.io:', e);
      }
    } else {
      console.log('⚠️ Socket.IO init not configured.');
    }

    try {
      if (cameraManager && typeof cameraManager.startAllFromDb === 'function') {
        await cameraManager.startAllFromDb();
        console.log('✅ cameraManager.startAllFromDb completed');
      } else {
        console.log('⚠️ cameraManager.startAllFromDb not available — skipping camera manager startup');
      }
    } catch (e) {
      console.error('cameraManager.startAllFromDb error:', e);
    }

    server.listen(PORT, () => {
      console.log(`🚀 Server started on PORT = ${PORT}`);
      console.log(`🌐 CLIENT_URL = ${CLIENT_URL}`);
    });

  } catch (e) {
    console.error('❌ Server start error:', e);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  console.log(`Received ${signal}. Shutting down...`);
  try {
    server.close(() => console.log('HTTP server closed'));

    try {
      if (cameraManager && typeof cameraManager.stopAll === 'function') {
        await cameraManager.stopAll();
        console.log('cameraManager.stopAll completed');
      }
    } catch (e) {
      console.warn('cameraManager stop error', e);
    }

    try {
      if (global.io && typeof global.io.close === 'function') {
        global.io.close();
        console.log('Socket.IO server closed');
      }
    } catch (e) {
      console.warn('socketServer close error', e);
    }

    try {
      if (mediasoupManager?.stop) {
        await mediasoupManager.stop();
        console.log('mediasoupManager stopped');
      }
    } catch (e) {
      console.warn('mediasoupManager stop error', e);
    }

    try {
      await mongoose.disconnect();
      console.log('MongoDB disconnected');
    } catch (e) {
      console.warn('mongoose.disconnect error', e);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown', err);
    process.exit(1);
  }
};

process.on('uncaughtException', (err) => console.error('uncaughtException', err));
process.on('unhandledRejection', (reason) => console.error('unhandledRejection', reason));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
