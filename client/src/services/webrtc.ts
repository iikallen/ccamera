// client/src/services/webrtc.ts
import { io, Socket } from 'socket.io-client';
import { Device } from 'mediasoup-client';

const SERVER = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:5000';
const TURN_URL = process.env.NEXT_PUBLIC_TURN_URL || ''; // optional TURN
const TURN_USER = process.env.NEXT_PUBLIC_TURN_USER || '';
const TURN_PASS = process.env.NEXT_PUBLIC_TURN_PASS || '';

type ProducerInfo = { cameraId: string; producerId: string };

function buildIceServers() {
  const iceServers: any[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (TURN_URL) {
    const turn: any = { urls: TURN_URL };
    if (TURN_USER) turn.username = TURN_USER;
    if (TURN_PASS) turn.credential = TURN_PASS;
    iceServers.push(turn);
  }
  return iceServers;
}

class WebRTCClient {
  socket: Socket | null = null;
  device: Device | null = null;
  recvTransport: any = null;
  consumers: Map<string, any> = new Map();

  private _initPromise: Promise<{ routerRtpCapabilities: any } | void> | null = null;

  private createSocket(accessToken?: string): Socket {
    const s = io(SERVER, {
      auth: accessToken ? { token: accessToken } : {},
      query: accessToken ? { token: accessToken } : {},
      transports: ['polling', 'websocket'],
      withCredentials: true,
      autoConnect: false,
      reconnection: false // manual reconnection handling
    });

    s.on('connect', () => console.log('[webrtc] socket.connect id=', s.id));
    s.on('connect_error', (err: any) => {
      console.error('[webrtc] socket.connect_error', (err as any)?.message ?? err);
    });
    s.on('error', (e: any) => console.error('[webrtc] socket.error', e));
    s.on('disconnect', (reason: any) => console.warn('[webrtc] socket.disconnect', reason));

    return s;
  }

  private waitForConnect(sock: Socket, timeoutMs = 15000) {
    return new Promise<void>((resolve, reject) => {
      const onConnect = () => { cleanup(); resolve(); };
      const onError = (err: any) => { cleanup(); reject(err); };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('socket connect timeout'));
      }, timeoutMs);

      function cleanup() {
        clearTimeout(timeout);
        try { sock.off('connect', onConnect); } catch {}
        try { sock.off('connect_error', onError); } catch {}
      }

      sock.once('connect', onConnect);
      sock.once('connect_error', onError);
      sock.connect();
    });
  }

  async init(accessToken?: string): Promise<{ routerRtpCapabilities: any } | void> {
    // if already running init - reuse promise
    if (this._initPromise) {
      console.log('[webrtc] init already in progress — awaiting existing init');
      return this._initPromise;
    }

    this._initPromise = (async () => {
      if (!accessToken && typeof window !== 'undefined') {
        accessToken = localStorage.getItem('token') || undefined;
      }

      console.trace('[webrtc] init called');

      // clean up prev socket if any
      if (this.socket) {
        try { this.socket.removeAllListeners(); } catch {}
        try { this.socket.close(); } catch {}
        this.socket = null;
      }

      // create a new socket (with handlers)
      this.socket = this.createSocket(accessToken);

      // attempt connect with simple backoff
      const maxAttempts = 3;
      let lastErr: any = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          console.log(`[webrtc] connect attempt ${attempt}/${maxAttempts}`);
          if (!this.socket) this.socket = this.createSocket(accessToken);
          await this.waitForConnect(this.socket, 12000);
          console.log('[webrtc] socket connected, continuing init');
          break;
        } catch (err) {
          lastErr = err;
          console.warn('[webrtc] connect attempt failed:', (err as any)?.message ?? err);
          try { this.socket?.removeAllListeners(); } catch {}
          try { this.socket?.close(); } catch {}
          this.socket = null;

          if (attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, attempt * 1000));
            this.socket = this.createSocket(accessToken);
          } else {
            throw lastErr;
          }
        }
      }

      if (!this.socket) throw new Error('socket missing after connect attempts');

      // authenticate via legacy auth event (server supports)
      const routerCaps = await new Promise<any>((resolve, reject) => {
        if (!this.socket) return reject(new Error('socket missing'));
        this.socket.emit('auth', { token: accessToken }, (res: any) => {
          if (!res) return reject(new Error('no response from auth'));
          if (!res.ok) return reject(new Error(res.reason || 'auth failed'));
          resolve(res.routerRtpCapabilities);
        });
      });

      this.device = new Device();
      await this.device.load({ routerRtpCapabilities: routerCaps });
      console.log('[webrtc] device loaded, rtpCapabilities:', (this.device as any).rtpCapabilities);

      return { routerRtpCapabilities: routerCaps };
    })();

    try {
      return await this._initPromise;
    } finally {
      this._initPromise = null;
    }
  }

  // ensure initialized; if not, try init automatically (reads token from localStorage)
  private async ensureInitialized() {
    if (!this.socket || !this.device) {
      console.log('[webrtc] ensureInitialized: socket/device missing — attempting init()');
      await this.init();
    }
    if (!this.socket) throw new Error('socket not initialized');
  }

  async listProducers(): Promise<ProducerInfo[]> {
    // attempt to init if needed
    if (!this.socket) {
      try {
        await this.ensureInitialized();
      } catch (e) {
        throw new Error('socket not initialized (listProducers): ' + String(e));
      }
    }

    return new Promise((resolve, reject) => {
      this.socket!.emit('listProducers', {}, (res: any) => {
        console.log('[webrtc] listProducers response:', res);
        if (!res || !res.ok) return reject(new Error(res?.reason || 'listProducers failed'));
        const producers = Array.isArray(res.producers) ? res.producers : [];
        resolve(producers);
      });
    });
  }

  async createRecvTransport() {
    if (!this.socket) throw new Error('socket not initialized');
    if (!this.device) throw new Error('device not initialized');

    const params = await new Promise<any>((resolve, reject) => {
      this.socket!.emit('createWebRtcTransport', {}, (res: any) => {
        console.log('[webrtc] createWebRtcTransport response:', res);
        if (!res || !res.ok) return reject(new Error(res?.error || 'createWebRtcTransport failed'));
        resolve(res.params);
      });
    });

    // warn when server gave 0.0.0.0 candidates
    try {
      const hasZeroIp = Array.isArray(params.iceCandidates)
        && params.iceCandidates.some((c: any) => (c && (c.address === '0.0.0.0' || c.ip === '0.0.0.0')));
      if (hasZeroIp || (params.iceParameters && params.iceParameters.iceLite)) {
        console.warn('[webrtc] server returned 0.0.0.0 or iceLite=true — set MEDIASOUP_ANNOUNCED_IP on server or use TURN.');
      }
    } catch (e) { /* ignore */ }

    const iceServers = buildIceServers();
    const transport = this.device.createRecvTransport({
      id: params.id,
      iceParameters: params.iceParameters,
      iceCandidates: params.iceCandidates,
      dtlsParameters: params.dtlsParameters,
      // @ts-ignore pass iceServers to RTCPeerConnection
      iceServers
    });

    transport.on('connect', ({ dtlsParameters }: any, callback: Function, errback: Function) => {
      this.socket!.emit('connectTransport', { dtlsParameters }, (res: any) => {
        if (res && res.ok) return callback();
        return errback(res && res.error ? res.error : 'connectTransport failed');
      });
    });

    transport.on('connectionstatechange', (state: string) => {
      console.log('[webrtc] recv transport connectionstatechange', state);
    });

    this.recvTransport = transport;
    return transport;
  }

  async consume(producerId: string): Promise<MediaStream> {
    // if socket missing, try to init automatically
    if (!this.socket || !this.device) {
      try {
        await this.ensureInitialized();
      } catch (e) {
        throw new Error('socket not initialized (consume): ' + String(e));
      }
    }
    if (!this.socket) throw new Error('socket not initialized');

    if (!this.recvTransport) await this.createRecvTransport();

    const payload: any = {
      producerId,
      rtpCapabilities: this.device ? (this.device as any).rtpCapabilities : null
    };
    console.log('[webrtc] consume: sending payload to server', { producerId, hasRtpCaps: !!payload.rtpCapabilities });

    const consumerInfo = await new Promise<any>((resolve, reject) => {
      this.socket!.emit('consume', payload, (res: any) => {
        console.log('[webrtc] consume response from server:', res);
        if (!res || !res.ok) return reject(new Error(res?.error || 'consume failed'));
        resolve(res);
      });
    });

    const consumer = await this.recvTransport.consume({
      id: consumerInfo.id,
      producerId: consumerInfo.producerId,
      kind: consumerInfo.kind,
      rtpParameters: consumerInfo.rtpParameters
    });

    this.consumers.set(consumer.id, consumer);

    const stream = new MediaStream();
    if (consumer.track) stream.addTrack(consumer.track);

    try { await consumer.resume(); } catch (e) { console.warn('[webrtc] consumer.resume failed', e); }

    return stream;
  }

  close() {
    try {
      for (const c of this.consumers.values()) {
        try { c.close(); } catch {}
      }
      this.consumers.clear();
      if (this.recvTransport) try { this.recvTransport.close(); } catch {}
      if (this.socket) {
        try { this.socket.removeAllListeners(); } catch {}
        try { this.socket.close(); } catch {}
        this.socket = null;
      }
    } catch (e) { /* ignore */ }
  }
}

export default new WebRTCClient();
