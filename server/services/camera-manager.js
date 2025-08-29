// server/services/camera-manager.js
const { spawn } = require('child_process');
const mediasoupManager = require('./mediasoup-manager');
const Camera = require('../models/camera-model');

const USE_NVENC_ENV = (process.env.USE_NVENC || 'true').toLowerCase();
const USE_NVENC_DEFAULT = (USE_NVENC_ENV === '1' || USE_NVENC_ENV === 'true');

const running = new Map();

function _buildFfmpegArgs(rtspUrl, dstIp, dstPort, useNvenc) {
  if (useNvenc) {
    return [
      '-hwaccel', 'cuda',
      '-hwaccel_output_format', 'cuda',
      '-c:v', 'hevc_cuvid',
      '-rtsp_transport', 'tcp',
      '-i', rtspUrl,
      '-an',
      '-pix_fmt', 'yuv420p',
      '-c:v', 'h264_nvenc',
      '-preset', 'p2',
      '-rc', 'vbr_hq',
      '-b:v', '1500000',
      '-tune', 'll',
      '-f', 'rtp',
      '-payload_type', '96',
      `rtp://${dstIp}:${dstPort}`
    ];
  } else {
    return [
      '-rtsp_transport', 'tcp',
      '-fflags', '+genpts',
      '-i', rtspUrl,
      '-an',
      '-pix_fmt', 'yuv420p',
      '-c:v', 'libx264', // перекодировать, если необходимо — безопасный вариант
      '-preset', 'veryfast',
      '-tune', 'zerolatency',
      '-b:v', '1500000',
      '-maxrate', '1500000',
      '-bufsize', '2000000',
      '-f', 'rtp',
      '-payload_type', '96',
      `rtp://${dstIp}:${dstPort}`
    ];
  }
}

function _spawnFfmpeg(args, ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg') {
  const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  return proc;
}

/**
 * startCamera: делегируем mediasoup-manager.createProducer (ensureProducerForCamera)
 * mediasoup-manager создаёт plain transport, запускает ffmpeg и возвращает { producer, transport, ffmpeg, rtpPort }
 */
async function startCamera(camera) {
  const id = String(camera._id || camera.id || camera.name || (`cam-${Date.now()}`));
  try {
    // Если передан rtspUrl прямо в запись — оставим его, иначе медиасуп-менеджер соберёт URL из ip/rtspPath/rtspPort/user/pass
    const created = await mediasoupManager.ensureProducerForCamera(camera);
    // created: { producer, transport, ffmpeg, rtpPort }
    const ff = created.ffmpeg;
    const destPort = created.rtpPort || (created.transport && created.transport.tuple && created.transport.tuple.localPort) || null;

    running.set(id, { proc: ff, port: destPort, useNvenc: false });

    if (ff && ff.stdout) {
      ff.stdout.on('data', (d) => console.log(`[ffmpeg:${id}] ${String(d).trim()}`));
    }
    if (ff && ff.stderr) {
      ff.stderr.on('data', (d) => console.log(`[ffmpeg:${id}] ${String(d).trim()}`));
    }
    if (ff && ff.on) {
      ff.on('exit', (code, sig) => {
        console.warn(`[camera ${id}] ffmpeg exited code=${code} sig=${sig}`);
        running.delete(id);
      });
      ff.on('error', (err) => {
        console.error(`[camera ${id}] ffmpeg error:`, err && err.message ? err.message : err);
      });
    }

    console.log(`[camera-manager] created producer for ${id} id=${created.producer?.id}`);

    if (global.io) {
      global.io.emit('newProducer', { cameraId: id, id: created.producer?.id });
      global.io.emit('producerListChanged', mediasoupManager.listProducers());
    }

    return created.producer;
  } catch (e) {
    console.error(`[camera-manager] startCamera error for ${id}:`, e && e.message ? e.message : e);
    const entry = running.get(id);
    if (entry && entry.proc && !entry.proc.killed) {
      try { entry.proc.kill('SIGKILL'); } catch (__) {}
    }
    running.delete(id);
    throw e;
  }
}

/**
 * stopCamera: останавливаем ffmpeg и закрываем producer (если есть)
 */
async function stopCamera(cameraIdOrDoc) {
  const id = String((cameraIdOrDoc && (cameraIdOrDoc._id || cameraIdOrDoc.id || cameraIdOrDoc.name)) || cameraIdOrDoc);
  try {
    const entry = running.get(id);
    if (entry && entry.proc && !entry.proc.killed) {
      try { entry.proc.kill('SIGTERM'); } catch (e) { try { entry.proc.kill('SIGKILL'); } catch {} }
      console.log(`[camera-manager] killed ffmpeg for ${id}`);
    }
    running.delete(id);

    // close producer if exists
    const list = mediasoupManager.listProducers(); // [{cameraId, producerId}]
    const found = list.find(x => String(x.cameraId) === String(id));
    if (found && found.producerId) {
      const producer = mediasoupManager.getProducerById(found.producerId);
      if (producer) {
        try {
          producer.close();
          console.log(`[camera-manager] closed producer ${found.producerId} for camera ${id}`);
        } catch (e) {
          console.warn(`[camera-manager] failed to close producer ${found.producerId}:`, e && e.message ? e.message : e);
        }
      }
    }

    return true;
  } catch (e) {
    console.warn(`[camera-manager] stopCamera error for ${id}:`, e && e.message ? e.message : e);
    return false;
  }
}

/**
 * startAllFromDb: прочитать камеры из БД и стартовать их.
 * (исправление: раньше использовался локальный жестко заданный массив cameras)
 */
async function startAllFromDb() {
  try {
    const cams = await Camera.find({ enabled: true }).lean();
    for (const c of cams) {
      try {
        await startCamera(c);
      } catch (err) {
        console.warn(`[camera-manager] failed to start camera ${c._id || c.id || c.name}:`, err && err.message ? err.message : err);
      }
    }
  } catch (e) {
    console.error('[camera-manager] startAllFromDb error:', e && e.message ? e.message : e);
  }
}

async function stopAll() {
  for (const [id, entry] of running.entries()) {
    try { if (entry.proc && !entry.proc.killed) entry.proc.kill('SIGKILL'); } catch (e) {}
    running.delete(id);
  }
}

module.exports = { startCamera, stopCamera, startAllFromDb, stopAll, _running: running };
