import type { PublishedTrack, RoomId } from '@minimal-cord/shared';

export type MediaKind = 'audio' | 'video';
export type MediaSource = PublishedTrack['source'];

export interface TransportListenInfo {
  protocol: 'udp' | 'tcp';
  ip: string;
  announcedAddress?: string;
}

export interface WebRtcTransportOptions {
  listenInfos: TransportListenInfo[];
  enableUdp: boolean;
  enableTcp: boolean;
  preferUdp: boolean;
}

export interface RtpCodecCapability {
  kind: MediaKind;
  mimeType: string;
  clockRate: number;
  channels?: number;
  parameters: Record<string, unknown>;
}

export interface MediasoupRuntimeConfig {
  worker: {
    rtcMinPort: number;
    rtcMaxPort: number;
  };
  webRtcTransport: WebRtcTransportOptions;
  routerMediaCodecs: RtpCodecCapability[];
}

interface EventedCloseable {
  on(event: string, listener: (...args: any[]) => void): void;
  close(): void;
}

export interface WebRtcTransport extends EventedCloseable {
  id: string;
  iceParameters: unknown;
  iceCandidates: unknown;
  dtlsParameters: unknown;
  sctpParameters: unknown;
  connect(options: { dtlsParameters: unknown }): Promise<void>;
  produce(options: {
    kind: MediaKind;
    rtpParameters: unknown;
    appData?: Record<string, unknown>;
  }): Promise<Producer>;
  consume(options: {
    producerId: string;
    rtpCapabilities: unknown;
    paused?: boolean;
  }): Promise<Consumer>;
}

export interface Producer extends EventedCloseable {
  id: string;
  kind: MediaKind;
}

export interface Consumer extends EventedCloseable {
  id: string;
  producerId: string;
  kind: MediaKind;
  rtpParameters: unknown;
}

interface Router {
  rtpCapabilities: unknown;
  createWebRtcTransport(options: WebRtcTransportOptions): Promise<WebRtcTransport>;
  canConsume(options: { producerId: string; rtpCapabilities: unknown }): boolean;
  close(): void;
}

interface Worker extends EventedCloseable {
  createRouter(options: { mediaCodecs: RtpCodecCapability[] }): Promise<Router>;
}

interface RoomProducerRecord {
  producer: Producer;
  participantId: string;
  transportId: string;
  kind: MediaKind;
  source: MediaSource;
}

interface RoomConsumerRecord {
  consumer: Consumer;
  producerId: string;
  participantId: string;
  transportId: string;
}

interface RoomTransportRecord {
  transport: WebRtcTransport;
  participantId: string;
}

export interface RoomMediaState {
  router: Router;
  transports: Map<string, RoomTransportRecord>;
  producers: Map<string, RoomProducerRecord>;
  consumers: Map<string, RoomConsumerRecord>;
}

export interface RoomMediaController {
  start(): Promise<void>;
  stop(): Promise<void>;
  getOrCreateRoom(roomId: RoomId): Promise<RoomMediaState>;
  getRouterRtpCapabilities(roomId: RoomId): Promise<unknown>;
  createTransport(roomId: RoomId, participantId: string, direction: 'send' | 'recv'): Promise<WebRtcTransport | undefined>;
  connectTransport(roomId: RoomId, transportId: string, dtlsParameters: unknown): Promise<boolean>;
  produce(
    roomId: RoomId,
    transportId: string,
    participantId: string,
    kind: MediaKind,
    rtpParameters: unknown,
    source: MediaSource
  ): Promise<PublishedTrack | undefined>;
  consume(
    roomId: RoomId,
    transportId: string,
    producerId: string,
    rtpCapabilities: unknown
  ): Promise<{ id: string; producerId: string; kind: MediaKind; rtpParameters: unknown } | undefined>;
  closeProducer(roomId: RoomId, participantId: string, producerId: string): Promise<PublishedTrack | undefined>;
  closeParticipant(roomId: RoomId, participantId: string): Promise<PublishedTrack[]>;
  closeRoom(roomId: RoomId): Promise<void>;
}

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildWebRtcTransportOptions(input: {
  listenIp: string;
  announcedIp: string;
}): WebRtcTransportOptions {
  return {
    listenInfos: [
      { protocol: 'udp', ip: input.listenIp, announcedAddress: input.announcedIp },
      { protocol: 'tcp', ip: input.listenIp, announcedAddress: input.announcedIp }
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true
  };
}

export function parseMediasoupConfig(env: NodeJS.ProcessEnv = process.env): MediasoupRuntimeConfig {
  return {
    worker: {
      rtcMinPort: parsePort(env.MEDIASOUP_MIN_PORT, 40_000),
      rtcMaxPort: parsePort(env.MEDIASOUP_MAX_PORT, 49_999)
    },
    webRtcTransport: buildWebRtcTransportOptions({
      listenIp: env.MEDIASOUP_LISTEN_IP ?? '0.0.0.0',
      announcedIp: env.MEDIASOUP_ANNOUNCED_IP ?? '127.0.0.1'
    }),
    routerMediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48_000,
        channels: 2,
        parameters: {}
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90_000,
        parameters: {}
      }
    ]
  };
}

function createMediaRuntimeError(message: string): Error {
  return new Error(`MediasoupService: ${message}`);
}

function toPublishedTrack(record: RoomProducerRecord): PublishedTrack {
  return {
    producerId: record.producer.id,
    participantId: record.participantId,
    kind: record.kind,
    source: record.source
  };
}

export class MediasoupService implements RoomMediaController {
  private worker: Worker | undefined;
  private readonly rooms = new Map<RoomId, RoomMediaState>();

  constructor(
    private readonly config: MediasoupRuntimeConfig = parseMediasoupConfig(),
    private readonly dependencies: { createWorker?: (config: { rtcMinPort: number; rtcMaxPort: number }) => Promise<Worker> } = {}
  ) {}

  async start(): Promise<void> {
    if (this.worker) return;

    let createWorker = this.dependencies.createWorker;
    if (!createWorker) {
      const mediasoup = await import('mediasoup');
      createWorker = (mediasoup as any).createWorker ?? (mediasoup as any).default?.createWorker;
    }
    if (typeof createWorker !== 'function') {
      throw createMediaRuntimeError('mediasoup createWorker export is unavailable');
    }

    this.worker = (await createWorker(this.config.worker)) as Worker;
  }

  async stop(): Promise<void> {
    for (const roomId of [...this.rooms.keys()]) {
      await this.closeRoom(roomId);
    }

    if (this.worker) {
      this.worker.close();
      this.worker = undefined;
    }
  }

  async getOrCreateRoom(roomId: RoomId): Promise<RoomMediaState> {
    const existing = this.rooms.get(roomId);
    if (existing) return existing;

    if (!this.worker) {
      throw createMediaRuntimeError('service not started');
    }

    const router = await this.worker.createRouter({ mediaCodecs: this.config.routerMediaCodecs });
    const room: RoomMediaState = {
      router,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map()
    };

    this.rooms.set(roomId, room);
    return room;
  }

  async getRouterRtpCapabilities(roomId: RoomId): Promise<unknown> {
    return (await this.getOrCreateRoom(roomId)).router.rtpCapabilities;
  }

  async createTransport(roomId: RoomId, participantId: string, _direction: 'send' | 'recv'): Promise<WebRtcTransport | undefined> {
    const room = await this.getOrCreateRoom(roomId);
    const transport = await room.router.createWebRtcTransport(this.config.webRtcTransport);

    room.transports.set(transport.id, { transport, participantId });
    transport.on('close', () => {
      room.transports.delete(transport.id);
    });

    return transport;
  }

  async connectTransport(roomId: RoomId, transportId: string, dtlsParameters: unknown): Promise<boolean> {
    const room = this.rooms.get(roomId);
    const transportRecord = room?.transports.get(transportId);
    if (!transportRecord) return false;

    await transportRecord.transport.connect({ dtlsParameters });
    return true;
  }

  async produce(
    roomId: RoomId,
    transportId: string,
    participantId: string,
    kind: MediaKind,
    rtpParameters: unknown,
    source: MediaSource
  ): Promise<PublishedTrack | undefined> {
    const room = this.rooms.get(roomId);
    const transportRecord = room?.transports.get(transportId);
    if (!room || !transportRecord || transportRecord.participantId !== participantId) return undefined;

    const producer = await transportRecord.transport.produce({ kind, rtpParameters, appData: { participantId, source } });
    const record: RoomProducerRecord = { producer, participantId, transportId, kind, source };

    room.producers.set(producer.id, record);
    producer.on('close', () => {
      room.producers.delete(producer.id);
    });
    producer.on('transportclose', () => {
      room.producers.delete(producer.id);
    });

    return toPublishedTrack(record);
  }

  async consume(
    roomId: RoomId,
    transportId: string,
    producerId: string,
    rtpCapabilities: unknown
  ): Promise<{ id: string; producerId: string; kind: MediaKind; rtpParameters: unknown } | undefined> {
    const room = this.rooms.get(roomId);
    const transportRecord = room?.transports.get(transportId);
    const producer = room?.producers.get(producerId);
    if (!room || !transportRecord || !producer) return undefined;

    if (!room.router.canConsume({ producerId, rtpCapabilities })) return undefined;

    const consumer = await transportRecord.transport.consume({ producerId, rtpCapabilities, paused: false });
    room.consumers.set(consumer.id, { consumer, producerId, participantId: transportRecord.participantId, transportId });
    consumer.on('close', () => {
      room.consumers.delete(consumer.id);
    });
    consumer.on('transportclose', () => {
      room.consumers.delete(consumer.id);
    });
    consumer.on('producerclose', () => {
      room.consumers.delete(consumer.id);
    });

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters
    };
  }

  async closeProducer(roomId: RoomId, participantId: string, producerId: string): Promise<PublishedTrack | undefined> {
    const room = this.rooms.get(roomId);
    const record = room?.producers.get(producerId);
    if (!room || !record || record.participantId !== participantId) return undefined;

    record.producer.close();
    room.producers.delete(producerId);
    return toPublishedTrack(record);
  }

  async closeParticipant(roomId: RoomId, participantId: string): Promise<PublishedTrack[]> {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    const closed: PublishedTrack[] = [];

    for (const [producerId, record] of [...room.producers.entries()]) {
      if (record.participantId !== participantId) continue;
      record.producer.close();
      room.producers.delete(producerId);
      closed.push(toPublishedTrack(record));
    }

    for (const [consumerId, record] of [...room.consumers.entries()]) {
      if (record.participantId !== participantId) continue;
      record.consumer.close();
      room.consumers.delete(consumerId);
    }

    for (const [transportId, record] of [...room.transports.entries()]) {
      if (record.participantId !== participantId) continue;
      record.transport.close();
      room.transports.delete(transportId);
    }

    return closed;
  }

  async closeRoom(roomId: RoomId): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    for (const transport of room.transports.values()) {
      transport.transport.close();
    }

    for (const producer of room.producers.values()) {
      producer.producer.close();
    }

    for (const consumer of room.consumers.values()) {
      consumer.consumer.close();
    }

    room.transports.clear();
    room.producers.clear();
    room.consumers.clear();
    room.router.close();
    this.rooms.delete(roomId);
  }
}
