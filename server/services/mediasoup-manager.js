// server/services/mediasoup-manager.js
const mediasoup = require('mediasoup');
const { spawn } = require('child_process');
const Camera = require('../models/camera-model');

const NUM_WORKERS = Number(process.env.MEDIASOUP_NUM_WORKERS || 1);
const RTC_MIN_PORT = Number(process.env.MEDIASOUP_RTC_MIN_PORT || 20000);
const RTC_MAX_PORT = Number(process.env.MEDIASOUP_RTC_MAX_PORT || 20200);
const RTP_PORT_BASE = Number(process.env.MEDIASOUP_RTP_BASE || 10000);
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';
const ANNOUNCED_IP = process.env.MEDIASOUP_ANNOUNCED_IP || null;

let worker = null;
let router = null;
const producers = new Map(); // cameraId -> { producer, transport, ffmpeg, rtpPort }

module.exports = {
  start: async function () {
    if (worker) return;
    worker = await mediasoup.createWorker({
      rtcMinPort: RTC_MIN_PORT,
      rtcMaxPort: RTC_MAX_PORT
    });
    worker.on('died', () => {
      console.error('mediasoup worker died, exiting');
      process.exit(1);
    });

    router = await worker.createRouter({
      mediaCodecs: [
        {
          kind: 'video',
          mimeType: 'video/H264',
          clockRate: 90000,
          // убрал жесткую привязку к profile-level-id чтобы быть гибче
          parameters: {
            'packetization-mode': 1,
            'level-asymmetry-allowed': 1
          }
        }
      ]
    });

    const cams = await Camera.find({ enabled: true }).lean();
    let portOffset = 0;
    for (const cam of cams) {
      try {
        const rtpPort = RTP_PORT_BASE + portOffset;
        await this._createProducerFromCamera(cam, rtpPort);
        portOffset += 2;
      } catch (e) {
        console.warn('failed to create producer for camera', cam._id || cam.name, e && e.message ? e.message : e);
      }
    }
  },

  stop: async function () {
    for (const [k, v] of producers) {
      try { v.ffmpeg.kill('SIGTERM'); } catch {}
      try { v.producer.close(); } catch {}
      try { v.transport.close(); } catch {}
    }
    producers.clear();
    if (router) { try { await router.close(); } catch {} router = null; }
    if (worker) { try { await worker.close(); } catch {} worker = null; }
  },

  getRouterRtpCapabilities() {
    return router ? router.rtpCapabilities : null;
  },

  getRouter() {
    return router;
  },

  listProducers() {
    return Array.from(producers.entries()).map(([cameraId, { producer }]) => ({
      cameraId,
      producerId: producer.id
    }));
  },

  getProducerById(producerId) {
    for (const { producer } of producers.values()) {
      if (producer.id === producerId) return producer;
    }
    return null;
  },

  // internal helper: создаёт plain transport + ffmpeg + producer для камеры
  _createProducerFromCamera: async function (camDoc, rtpPort = 10000) {
    if (!router) throw new Error('router not initialized');
    const cameraId = String(camDoc._id || camDoc.name || (`cam-${Date.now()}`));

    if (producers.has(cameraId)) return producers.get(cameraId);

    // validate or build RTSP url
    let rtsp = null;
    if (camDoc.rtspUrl && String(camDoc.rtspUrl).trim()) {
      rtsp = String(camDoc.rtspUrl).trim();
    } else {
      // require ip at minimum
      if (!camDoc.ip) {
        throw new Error(`camera ${cameraId} missing 'ip' and no 'rtspUrl' provided`);
      }
      const port = camDoc.rtspPort || 554;
      const user = camDoc.user ? String(camDoc.user) : '';
      const pass = camDoc.pass ? String(camDoc.pass) : '';
      const auth = (user || pass) ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : '';
      const channel = camDoc.rtspChannel || '101';
      rtsp = `rtsp://${auth}${camDoc.ip}:${port}/Streaming/Channels/${channel}`;
    }

    // safe logging: don't print password
    const maskedRtsp = rtsp.replace(/\/\/([^:@\/]+):([^@\/]+)@/, '//$1:***@');
    console.log(`[mediasoup-manager] camera=${cameraId} using rtsp=${maskedRtsp}`);

    // create plain transport
    const listenIp = '127.0.0.1';
    const transport = await router.createPlainTransport({
      listenIp: { ip: listenIp, announcedIp: ANNOUNCED_IP || undefined },
      rtcpMux: true,
      comedia: true
    });

    // log tuple for diagnostics (may be undefined until first packet for comedia)
    const tuple = transport.tuple || null;
    console.log(`[mediasoup-manager] plain transport created for camera=${cameraId}, tuple=`, tuple);

    // choose dest port for ffmpeg:
    // prefer transport.tuple.localPort or transport.tuple.port if available, otherwise fallback to provided rtpPort
    let chosenPort = null;
    try {
      if (tuple) {
        chosenPort = tuple.localPort || tuple.port || tuple.localPort;
      }
    } catch (e) {
      chosenPort = null;
    }
    const destPort = chosenPort || Number(rtpPort) || RTP_PORT_BASE;
    console.log(`[mediasoup-manager] chosen destPort=${destPort} for ffmpeg (camera=${cameraId})`);

    // spawn ffmpeg to push RTP to local plain transport port
    const args = [
      '-rtsp_transport', 'tcp',
      '-fflags', '+genpts', // generate PTS if missing
      '-i', rtsp,
      '-an',
      '-c:v', 'copy',
      '-payload_type', '96',
      '-f', 'rtp',
      `rtp://${listenIp}:${destPort}`
    ];

    console.log(`[mediasoup-manager] starting ffmpeg for camera=${cameraId} -> rtp://${listenIp}:${destPort}`);
    console.log(`[mediasoup-manager] ffmpeg args: ${args.join(' ')}`);

    const ff = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    ff.stdout && ff.stdout.on('data', (d) => {
      const s = String(d).trim();
      if (s) console.log(`[ffmpeg ${cameraId} stdout] ${s.split('\n').slice(-3).join('\n')}`);
    });
    ff.stderr && ff.stderr.on('data', (d) => {
      const s = String(d).trim();
      if (s) console.log(`[ffmpeg ${cameraId} stderr] ${s.split('\n').slice(-3).join('\n')}`);
    });

    ff.on('exit', (code, sig) => {
      console.warn(`ffmpeg for camera ${cameraId} exited code=${code} sig=${sig}`);
    });

    ff.on('error', (err) => {
      console.error(`ffmpeg spawn error for camera ${cameraId}:`, err && err.message ? err.message : err);
    });

    // Build minimal rtpParameters that matches ffmpeg output.
    const rtpParameters = {
      codecs: [
        {
          mimeType: 'video/H264',
          payloadType: 96,
          clockRate: 90000,
          parameters: { 'packetization-mode': 1 }
        }
      ],
      encodings: [{ ssrc: (Math.floor(Math.random() * 0xffffffff)) }]
    };

    // transport.produce expects to receive incoming RTP from ffmpeg as plain transport.
    const producer = await transport.produce({ kind: 'video', rtpParameters, appData: { cameraId } });

    console.log(`[mediasoup-manager] producer created for camera=${cameraId}: id=${producer.id}, payloadType=${rtpParameters.codecs[0].payloadType}`);

    producer.on('close', () => {
      try { transport.close(); } catch {}
      try { ff.kill('SIGTERM'); } catch {}
      producers.delete(cameraId);
      console.log(`[mediasoup-manager] producer closed for camera=${cameraId}, id=${producer.id}`);
    });

    producer.on('transportclose', () => {
      try { ff.kill('SIGTERM'); } catch {}
      producers.delete(cameraId);
      console.log(`[mediasoup-manager] producer transport closed for camera=${cameraId}, id=${producer.id}`);
    });

    producers.set(cameraId, { producer, transport, ffmpeg: ff, rtpPort: destPort });
    return { producer, transport, ffmpeg: ff, rtpPort: destPort };
  },

  // совместимость: камера-менеджер вызывает createPlainTransportForCamera
  createPlainTransportForCamera: async function (camDoc, rtpPort = undefined) {
    const port = typeof rtpPort === 'number' ? rtpPort : undefined;
    return this._createProducerFromCamera(camDoc, port);
  },

  ensureProducerForCamera: async function (camDoc) {
    const cameraId = String(camDoc._id || camDoc.name);
    if (producers.has(cameraId)) return producers.get(cameraId);
    let used = new Set(Array.from(producers.values()).map(p => p.rtpPort));
    let base = RTP_PORT_BASE;
    while (used.has(base)) base += 2;
    return this._createProducerFromCamera(camDoc, base);
  }
};
