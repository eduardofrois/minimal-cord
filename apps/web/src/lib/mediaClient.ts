import type { ClientMessage, MediaSource, PublishedTrack, ServerMessage } from '@minimal-cord/shared';
import { Device, type types } from 'mediasoup-client';
import type { RoomSocket } from './wsClient';

type Waiter = {
  matches(message: ServerMessage): boolean;
  settle(message: ServerMessage): void;
  reject(error: Error): void;
  timeout: ReturnType<typeof setTimeout>;
};

export type RemoteTrack = PublishedTrack & {
  track: MediaStreamTrack;
};

const RESPONSE_TIMEOUT_MS = 15_000;

/**
 * Wraps mediasoup-client on top of the room WebSocket.
 *
 * The room protocol carries no request ids, so each request parks a waiter that
 * is settled by the first matching server message.
 */
export class RoomMediaClient {
  private readonly device = new Device();
  private readonly waiters = new Set<Waiter>();
  private readonly producers = new Map<string, types.Producer>();
  private sendTransport?: types.Transport;
  private recvTransport?: types.Transport;
  private closed = false;

  constructor(private readonly socket: RoomSocket) {}

  /** Feeds every server message into the pending waiters. */
  handleMessage(message: ServerMessage): void {
    for (const waiter of this.waiters) {
      if (!waiter.matches(message)) continue;

      this.waiters.delete(waiter);
      clearTimeout(waiter.timeout);
      waiter.settle(message);
      return;
    }
  }

  get loaded(): boolean {
    return this.device.loaded;
  }

  async load(): Promise<void> {
    if (this.device.loaded) return;

    const response = await this.request(
      { type: 'media:get-router-rtp-capabilities' },
      (message): message is Extract<ServerMessage, { type: 'media:router-rtp-capabilities' }> =>
        message.type === 'media:router-rtp-capabilities'
    );

    await this.device.load({ routerRtpCapabilities: response.rtpCapabilities as types.RtpCapabilities });
  }

  async openSendTransport(): Promise<void> {
    if (this.sendTransport) return;

    const options = await this.requestTransport('send');
    const transport = this.device.createSendTransport(options);

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      this.connectTransport(transport.id, dtlsParameters).then(callback, errback);
    });

    transport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
      this.requestProduce(transport.id, kind, rtpParameters, appData.source as MediaSource).then(
        (producer) => callback({ id: producer.producerId }),
        errback
      );
    });

    this.sendTransport = transport;
  }

  async openRecvTransport(): Promise<void> {
    if (this.recvTransport) return;

    const options = await this.requestTransport('recv');
    const transport = this.device.createRecvTransport(options);

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      this.connectTransport(transport.id, dtlsParameters).then(callback, errback);
    });

    this.recvTransport = transport;
  }

  /** Producers published to the room before this participant joined. */
  async listRemoteProducers(): Promise<PublishedTrack[]> {
    const response = await this.request(
      { type: 'media:get-producers' },
      (message): message is Extract<ServerMessage, { type: 'media:producers' }> => message.type === 'media:producers'
    );

    return response.producers;
  }

  async publish(track: MediaStreamTrack, source: MediaSource): Promise<string> {
    if (!this.sendTransport) throw new Error('send transport not ready');

    const producer = await this.sendTransport.produce({ track, appData: { source } });
    this.producers.set(producer.id, producer);

    return producer.id;
  }

  unpublish(producerId: string): void {
    const producer = this.producers.get(producerId);
    if (!producer) return;

    producer.close();
    this.producers.delete(producerId);
    this.socket.send({ type: 'media:close-producer', producerId });
  }

  async consume(producer: PublishedTrack): Promise<RemoteTrack> {
    if (!this.recvTransport) throw new Error('recv transport not ready');

    const response = await this.request(
      {
        type: 'media:consume',
        transportId: this.recvTransport.id,
        producerId: producer.producerId,
        rtpCapabilities: this.device.rtpCapabilities
      },
      (message): message is Extract<ServerMessage, { type: 'media:consumer-created' }> =>
        message.type === 'media:consumer-created' &&
        (message.consumerOptions as { producerId?: string }).producerId === producer.producerId
    );

    const consumer = await this.recvTransport.consume(response.consumerOptions as types.ConsumerOptions);

    return { ...producer, track: consumer.track };
  }

  close(): void {
    this.closed = true;

    for (const waiter of this.waiters) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error('Conexão de mídia encerrada.'));
    }
    this.waiters.clear();

    for (const producer of this.producers.values()) producer.close();
    this.producers.clear();

    this.sendTransport?.close();
    this.recvTransport?.close();
  }

  private async requestTransport(direction: 'send' | 'recv'): Promise<types.TransportOptions> {
    const response = await this.request(
      { type: 'media:create-transport', direction },
      (message): message is Extract<ServerMessage, { type: 'media:transport-created' }> =>
        message.type === 'media:transport-created' && message.direction === direction
    );

    return response.transportOptions as types.TransportOptions;
  }

  private async connectTransport(transportId: string, dtlsParameters: types.DtlsParameters): Promise<void> {
    await this.request(
      { type: 'media:connect-transport', transportId, dtlsParameters },
      (message): message is Extract<ServerMessage, { type: 'media:transport-connected' }> =>
        message.type === 'media:transport-connected' && message.transportId === transportId
    );
  }

  private async requestProduce(
    transportId: string,
    kind: types.MediaKind,
    rtpParameters: types.RtpParameters,
    source: MediaSource
  ): Promise<PublishedTrack> {
    const response = await this.request(
      { type: 'media:produce', transportId, kind, rtpParameters, source },
      (message): message is Extract<ServerMessage, { type: 'media:produced' }> =>
        message.type === 'media:produced' && message.producer.source === source && message.producer.kind === kind
    );

    return response.producer;
  }

  private request<TResponse extends ServerMessage>(
    request: ClientMessage,
    matches: (message: ServerMessage) => message is TResponse
  ): Promise<TResponse> {
    if (this.closed) return Promise.reject(new Error('Conexão de mídia encerrada.'));

    return new Promise<TResponse>((resolve, reject) => {
      const waiter: Waiter = {
        matches: (message) => matches(message) || message.type === 'error',
        settle: (message) => {
          if (message.type === 'error') reject(new Error(message.message));
          else resolve(message as TResponse);
        },
        reject,
        timeout: setTimeout(() => {
          this.waiters.delete(waiter);
          reject(new Error(`O servidor não respondeu a ${request.type}.`));
        }, RESPONSE_TIMEOUT_MS)
      };

      this.waiters.add(waiter);
      this.socket.send(request);
    });
  }
}
