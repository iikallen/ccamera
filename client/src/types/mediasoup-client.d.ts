// легкие типы для mediasoup-client (минимум для этого проекта)
declare module 'mediasoup-client' {
  export type RtpCapabilities = any;
  export type DeviceOptions = any;

  export class Device {
    constructor(options?: DeviceOptions);
    load({ routerRtpCapabilities }: { routerRtpCapabilities: RtpCapabilities }): Promise<void>;
    canProduce(kind: string): boolean;
    rtpCapabilities: RtpCapabilities;
    createRecvTransport(options: {
      id: string;
      iceParameters: any;
      iceCandidates: any[];
      dtlsParameters: any;
      sctpParameters?: any;
    }): Transport;
    createSendTransport?: (options: any) => Transport;
  }

  export interface Transport {
    on(event: 'connect' | 'connectionstatechange' | string, cb: (...args: any[]) => void): void;
    consume(opts: { id: string; producerId: string; kind: string; rtpParameters: any; }): Promise<Consumer>;
    close(): void;
  }

  export interface Consumer {
    id: string;
    producerId: string;
    kind: string;
    rtpParameters: any;
    track: MediaStreamTrack;
    resume(): Promise<void>;
    close(): void;
  }

  const exported: { Device: typeof Device };
  export default exported;
}
