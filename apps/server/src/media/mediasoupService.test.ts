import { describe, expect, it } from 'vitest';
import { buildWebRtcTransportOptions, MediasoupService, parseMediasoupConfig } from './mediasoupService.js';

type Listener = (...args: any[]) => void;

class FakeEvented {
  private readonly listeners = new Map<string, Listener[]>();

  on(event: string, listener: Listener): void {
    const current = this.listeners.get(event) ?? [];
    current.push(listener);
    this.listeners.set(event, current);
  }

  emit(event: string, ...args: any[]): void {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(...args);
    }
  }
}

class FakeConsumer extends FakeEvented {
  readonly kind = 'video' as const;
  readonly rtpParameters = {};

  constructor(
    readonly id: string,
    readonly producerId: string
  ) {
    super();
  }

  close(): void {
    this.emit('close');
  }
}

class FakeProducer extends FakeEvented {
  readonly kind = 'audio' as const;
  readonly consumers: FakeConsumer[] = [];

  constructor(
    readonly id: string,
    readonly ownerTransportId: string
  ) {
    super();
  }

  close(): void {
    this.emit('close');
    for (const consumer of this.consumers) {
      consumer.emit('producerclose');
    }
  }
}

class FakeTransport extends FakeEvented {
  readonly iceParameters = {};
  readonly iceCandidates = [];
  readonly dtlsParameters = {};
  readonly sctpParameters = undefined;
  readonly producers: FakeProducer[] = [];
  readonly consumers: FakeConsumer[] = [];

  constructor(
    readonly id: string,
    private readonly transportIndex: number,
    private readonly producerById: Map<string, FakeProducer>
  ) {
    super();
  }

  async connect(): Promise<void> {}

  async produce(): Promise<FakeProducer> {
    const producer = new FakeProducer(`producer-${this.transportIndex}`, this.id);
    this.producers.push(producer);
    this.producerById.set(producer.id, producer);
    return producer;
  }

  async consume(options: { producerId: string }): Promise<FakeConsumer> {
    const consumer = new FakeConsumer(`consumer-${this.transportIndex}`, options.producerId);
    this.consumers.push(consumer);
    this.producerById.get(options.producerId)?.consumers.push(consumer);
    return consumer;
  }

  close(): void {
    this.emit('close');
    for (const producer of this.producers) {
      producer.emit('transportclose');
    }
    for (const consumer of this.consumers) {
      consumer.emit('transportclose');
    }
  }
}

function createFakeService() {
  const producerById = new Map<string, FakeProducer>();
  let transportIndex = 0;

  const fakeWorker = {
    close: () => {},
    on: () => {},
    createRouter: async () => ({
      rtpCapabilities: {},
      canConsume: () => true,
      createWebRtcTransport: async () => new FakeTransport(`transport-${++transportIndex}`, transportIndex, producerById),
      close: () => {}
    })
  };

  const service = new MediasoupService(parseMediasoupConfig(), {
    createWorker: async () => fakeWorker as any
  });

  return { service, producerById };
}

describe('mediasoup config helpers', () => {
  it('parses port range and announced ip', () => {
    const config = parseMediasoupConfig({
      MEDIASOUP_LISTEN_IP: '0.0.0.0',
      MEDIASOUP_ANNOUNCED_IP: '203.0.113.10',
      MEDIASOUP_MIN_PORT: '40000',
      MEDIASOUP_MAX_PORT: '49999'
    });

    expect(config.worker.rtcMinPort).toBe(40000);
    expect(config.worker.rtcMaxPort).toBe(49999);
    expect(config.webRtcTransport.listenInfos?.[0]?.announcedAddress).toBe('203.0.113.10');
  });

  it('builds WebRTC transport options for mediasoup', () => {
    const options = buildWebRtcTransportOptions({
      listenIp: '0.0.0.0',
      announcedIp: '127.0.0.1'
    });

    expect(options.enableUdp).toBe(true);
    expect(options.enableTcp).toBe(true);
    expect(options.preferUdp).toBe(true);
  });
});

describe('MediasoupService media cleanup', () => {
  it('closes only the requesting participant producer', async () => {
    const { service } = createFakeService();
    await service.start();

    const roomId = 'room-1';
    const transport = await service.createTransport(roomId, 'alice', 'send');
    const producer = await service.produce(roomId, transport!.id, 'alice', 'audio', {}, 'mic');

    expect(await service.closeProducer(roomId, 'bob', producer!.producerId)).toBeUndefined();
    expect(await service.closeProducer(roomId, 'alice', producer!.producerId)).toMatchObject(producer!);
  });

  it('rejects connecting another participant transport', async () => {
    const { service } = createFakeService();
    await service.start();

    const roomId = 'room-1';
    const transport = await service.createTransport(roomId, 'alice', 'send');

    await expect(service.connectTransport(roomId, 'bob', transport!.id, {})).resolves.toBe(false);
    await expect(service.connectTransport(roomId, 'alice', transport!.id, {})).resolves.toBe(true);
  });

  it('rejects consuming from another participant transport', async () => {
    const { service } = createFakeService();
    await service.start();

    const roomId = 'room-1';
    const aliceTransport = await service.createTransport(roomId, 'alice', 'send');
    const bobTransport = await service.createTransport(roomId, 'bob', 'recv');
    const producer = await service.produce(roomId, aliceTransport!.id, 'alice', 'audio', {}, 'mic');

    await expect(service.consume(roomId, 'alice', bobTransport!.id, producer!.producerId, {})).resolves.toBeUndefined();
    await expect(service.consume(roomId, 'bob', bobTransport!.id, producer!.producerId, {})).resolves.toMatchObject({
      producerId: producer!.producerId
    });
  });

  it('removes stale consumers when a producer closes', async () => {
    const { service } = createFakeService();
    await service.start();

    const roomId = 'room-1';
    const publisherTransport = await service.createTransport(roomId, 'alice', 'send');
    const viewerTransport = await service.createTransport(roomId, 'bob', 'recv');
    const producer = await service.produce(roomId, publisherTransport!.id, 'alice', 'audio', {}, 'mic');

    const room = await service.getOrCreateRoom(roomId);
    await service.consume(roomId, 'bob', viewerTransport!.id, producer!.producerId, {});
    expect(room.consumers.size).toBe(1);

    await service.closeProducer(roomId, 'alice', producer!.producerId);
    expect(room.consumers.size).toBe(0);
  });

  it('closes all participant media state on leave', async () => {
    const { service } = createFakeService();
    await service.start();

    const roomId = 'room-1';
    const aliceTransport = await service.createTransport(roomId, 'alice', 'send');
    const bobTransport = await service.createTransport(roomId, 'bob', 'recv');
    const aliceProducer = await service.produce(roomId, aliceTransport!.id, 'alice', 'audio', {}, 'mic');
    await service.consume(roomId, 'bob', bobTransport!.id, aliceProducer!.producerId, {});

    const room = await service.getOrCreateRoom(roomId);
    expect(room.transports.size).toBe(2);
    expect(room.producers.size).toBe(1);
    expect(room.consumers.size).toBe(1);

    const closed = await service.closeParticipant(roomId, 'alice');
    expect(closed).toEqual([aliceProducer]);
    expect(room.transports.size).toBe(1);
    expect(room.producers.size).toBe(0);
    expect(room.consumers.size).toBe(0);
  });
});
