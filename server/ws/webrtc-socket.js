// server/ws/webrtc-socket.js
const { Server } = require('socket.io');
const tokenService = require('../services/token-service');

module.exports = function initSocket(server, mediasoupMgr) {
  const mgr = mediasoupMgr || require('../services/mediasoup-manager');

  const io = new Server(server, {
    cors: {
      origin: (process.env.CLIENT_URL || 'http://localhost:3000'),
      methods: ['GET','POST'],
      credentials: true
    }
  });

  // --- Handshake middleware: валидируем токен при подключении (но не рвём, если токена нет) ---
  io.use((socket, next) => {
    try {
      console.log('[socket] handshake origin=', socket.handshake.headers.origin,
                  'auth=', JSON.stringify(socket.handshake.auth),
                  'query=', JSON.stringify(socket.handshake.query));

      const auth = socket.handshake.auth || {};
      const token = auth.token || (socket.handshake.query && socket.handshake.query.token);

      // Если токена нет — разрешаем подключиться, но пометим как unauthenticated.
      if (!token) {
        console.warn('[socket] handshake: no token provided — allowing unauthenticated socket. Use "auth" event to authenticate.');
        socket.user = null;
        socket.authenticated = false;
        socket.appData = socket.appData || {};
        return next();
      }

      const data = tokenService.validateAccessToken(token);
      if (!data) {
        console.warn('[socket] handshake invalid token');
        return next(new Error('unauth: invalid token'));
      }

      // attach user & mark authenticated
      socket.user = data;
      socket.authenticated = true;

      // store rtpCapabilities if provided
      socket.appData = socket.appData || {};
      if (auth.rtpCapabilities) {
        try {
          socket.appData.rtpCapabilities = typeof auth.rtpCapabilities === 'string'
            ? JSON.parse(auth.rtpCapabilities)
            : auth.rtpCapabilities;
        } catch (e) {
          socket.appData.rtpCapabilities = null;
        }
      }

      return next();
    } catch (e) {
      console.error('[socket] handshake error', e && e.message ? e.message : e);
      return next(new Error('unauth: exception'));
    }
  });

  io.on('connection', (socket) => {
    socket.appData = socket.appData || {};
    socket.authenticated = socket.authenticated || false;
    console.log('[socket] connected id=', socket.id, ' user=', socket.user ? socket.user.id || socket.user : null);

    // legacy auth event kept for compatibility and for unauthenticated sockets
    socket.on('auth', (payload, cb) => {
      try {
        const { token } = payload || {};
        if (!token) return cb && cb({ ok: false, reason: 'no token' });
        const data = tokenService.validateAccessToken(token);
        if (!data) return cb && cb({ ok: false, reason: 'invalid token' });
        socket.user = data;
        socket.authenticated = true;
        const caps = mgr.getRouterRtpCapabilities();
        return cb && cb({ ok: true, routerRtpCapabilities: caps });
      } catch (e) {
        return cb && cb({ ok: false, reason: e && e.message ? e.message : e });
      }
    });

    socket.on('listProducers', (args, cb) => {
      if (!socket.authenticated) return cb && cb({ ok: false, reason: 'unauth' });
      try {
        const list = mgr.listProducers();
        return cb && cb({ ok: true, producers: list });
      } catch (e) {
        return cb && cb({ ok: false, reason: e && e.message ? e.message : e });
      }
    });

    socket.on('createWebRtcTransport', async (data, cb) => {
      if (!socket.authenticated) return cb && cb({ ok: false, reason: 'unauth' });
      try {
        const router = mgr.getRouter();
        if (!router) return cb && cb({ ok: false, error: 'router not ready' });

        // явная переменная — удобно для логирования и отладки
        const announcedIp = process.env.MEDIASOUP_ANNOUNCED_IP || null;
        console.log('[socket] createWebRtcTransport announcedIp=', announcedIp);

        const transport = await router.createWebRtcTransport({
          listenIps: [{ ip: '0.0.0.0', announcedIp: announcedIp || undefined }],
          enableUdp: true,
          enableTcp: true,
          preferUdp: true
        });

        socket.appData.webRtcTransport = transport;

        // логируем tuple (может быть undefined пока не получены пакеты при comedia:true)
        console.log('[socket] transport.tuple =', transport.tuple || null);

        // логируем параметры, чтобы видеть реальные iceCandidates, iceParameters и dtlsParameters
        console.log('[socket] createWebRtcTransport returning params:', {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters
        });

        // предупреждение, если сервер возвращает 0.0.0.0 кандидаты или работает как iceLite
        try {
          const iceCandidates = transport.iceCandidates || [];
          const hasZeroIp = iceCandidates.some(c => {
            const ip = c && (c.ip || c.address);
            return ip === '0.0.0.0' || ip === '::' || !ip;
          });
          if (hasZeroIp || (transport.iceParameters && transport.iceParameters.iceLite)) {
            console.warn('[socket] WARNING: server returned 0.0.0.0 or iceLite=true — set MEDIASOUP_ANNOUNCED_IP on server to your public IP or use TURN. Current announcedIp=', announcedIp);
          }
        } catch (e) {
          // не критично
        }

        cb && cb({
          ok: true,
          params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters
          }
        });
      } catch (e) {
        cb && cb({ ok: false, error: e && e.message ? e.message : e });
      }
    });

    socket.on('connectTransport', async ({ dtlsParameters }, cb) => {
      try {
        const transport = socket.appData.webRtcTransport;
        if (!transport) return cb && cb({ ok: false, error: 'no transport' });
        await transport.connect({ dtlsParameters });
        return cb && cb({ ok: true });
      } catch (e) {
        return cb && cb({ ok: false, error: e && e.message ? e.message : e });
      }
    });

    socket.on('consume', async ({ producerId, rtpCapabilities }, cb) => {
      try {
        if (!socket.authenticated) return cb && cb({ ok: false, reason: 'unauth' });

        const transport = socket.appData.webRtcTransport;
        if (!transport) return cb && cb({ ok: false, error: 'no transport' });

        const producer = mgr.getProducerById(producerId);
        if (!producer) return cb && cb({ ok: false, error: 'producer not found' });

        const rtpCaps = rtpCapabilities || (socket.appData && socket.appData.rtpCapabilities) || mgr.getRouterRtpCapabilities();

        console.log('[socket] consume payload:', { producerId, hasRtpCaps: !!rtpCapabilities });

        const consumer = await transport.consume({
          producerId: producer.id,
          rtpCapabilities: rtpCaps,
          paused: false
        });

        socket.appData.consumers = socket.appData.consumers || [];
        socket.appData.consumers.push(consumer);

        cb && cb({
          ok: true,
          id: consumer.id,
          producerId: producer.id,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters
        });
      } catch (e) {
        cb && cb({ ok: false, error: e && e.message ? e.message : e });
      }
    });

    socket.on('disconnect', () => {
      try {
        if (socket.appData && socket.appData.consumers) {
          socket.appData.consumers.forEach(c => { try { c.close(); } catch {} });
        }
        if (socket.appData && socket.appData.webRtcTransport) {
          try { socket.appData.webRtcTransport.close(); } catch {}
        }
      } catch (e) {
        console.warn('socket disconnect cleanup error', e);
      }
    });
  });

  return io;
};
