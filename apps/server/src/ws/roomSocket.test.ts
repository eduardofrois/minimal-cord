import { afterEach, describe, expect, it } from 'vitest';
import WebSocket, { type RawData } from 'ws';
import { createApp } from '../app.js';
import type { RoomMediaController } from '../media/mediasoupService.js';

let cleanup: Array<() => Promise<void> | void> = [];

function waitForMessage(ws: WebSocket, type: string): Promise<any> {
  return new Promise((resolve) => {
    ws.on('message', (raw: RawData) => {
      const message = JSON.parse(raw.toString());
      if (message.type === type) resolve(message);
    });
  });
}

async function startTestServer() {
  const media: RoomMediaController = {
    start: async () => {},
    stop: async () => {},
    getOrCreateRoom: async () => {
      throw new Error('not used');
    },
    getRouterRtpCapabilities: async () => ({}),
    createTransport: async () => undefined,
    connectTransport: async () => false,
    produce: async () => undefined,
    consume: async () => undefined,
    closeProducer: async () => undefined,
    closeParticipant: async () => [],
    closeRoom: async () => {}
  };

  const app = await createApp({ maxParticipantsPerRoom: 20, media });
  await app.listen({ port: 0, host: '127.0.0.1' });
  cleanup.push(() => app.close());
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('missing test address');
  return `ws://127.0.0.1:${address.port}/ws`;
}

afterEach(async () => {
  await Promise.all(cleanup.map((fn) => fn()));
  cleanup = [];
});

describe('room WebSocket', () => {
  it('creates and joins a room', async () => {
    const url = await startTestServer();
    const creator = new WebSocket(url);
    cleanup.push(() => creator.close());

    await new Promise((resolve) => creator.once('open', resolve));
    const createdPromise = waitForMessage(creator, 'room:created');
    const joinedPromise = waitForMessage(creator, 'room:joined');
    creator.send(JSON.stringify({ type: 'room:create', displayName: 'Ana' }));
    const created = await createdPromise;
    const joined = await joinedPromise;

    expect(created.roomId).toHaveLength(10);
    expect(joined.participants[0].displayName).toBe('Ana');
  });

  it('rejects duplicate create and join messages on the same socket', async () => {
    const url = await startTestServer();
    const creator = new WebSocket(url);
    cleanup.push(() => creator.close());

    await new Promise((resolve) => creator.once('open', resolve));

    const createdPromise = waitForMessage(creator, 'room:created');
    const joinedPromise = waitForMessage(creator, 'room:joined');
    creator.send(JSON.stringify({ type: 'room:create', displayName: 'Ana' }));
    const created = await createdPromise;
    await joinedPromise;

    const duplicateCreateErrorPromise = waitForMessage(creator, 'error');
    creator.send(JSON.stringify({ type: 'room:create', displayName: 'Ana 2' }));
    await expect(duplicateCreateErrorPromise).resolves.toMatchObject({
      type: 'error',
      code: 'already-joined'
    });

    const duplicateJoinErrorPromise = waitForMessage(creator, 'error');
    creator.send(JSON.stringify({ type: 'room:join', roomId: created.roomId, displayName: 'Ana 3' }));
    await expect(duplicateJoinErrorPromise).resolves.toMatchObject({
      type: 'error',
      code: 'already-joined'
    });
  });

  it('broadcasts chat to participants in the same room', async () => {
    const url = await startTestServer();
    const ana = new WebSocket(url);
    const bia = new WebSocket(url);
    cleanup.push(() => ana.close(), () => bia.close());

    await Promise.all([
      new Promise((resolve) => ana.once('open', resolve)),
      new Promise((resolve) => bia.once('open', resolve))
    ]);

    const createdPromise = waitForMessage(ana, 'room:created');
    const joinedPromise = waitForMessage(ana, 'room:joined');
    ana.send(JSON.stringify({ type: 'room:create', displayName: 'Ana' }));
    const created = await createdPromise;
    await joinedPromise;

    const biaJoinedPromise = waitForMessage(bia, 'room:joined');
    bia.send(JSON.stringify({ type: 'room:join', roomId: created.roomId, displayName: 'Bia' }));
    await biaJoinedPromise;

    const chatPromise = waitForMessage(ana, 'chat:message');
    bia.send(JSON.stringify({ type: 'chat:send', text: 'oi' }));

    await expect(chatPromise).resolves.toMatchObject({
      type: 'chat:message',
      message: { displayName: 'Bia', text: 'oi' }
    });
  });

  it('cleans up participants on leave and close', async () => {
    const url = await startTestServer();
    const ana = new WebSocket(url);
    const bia = new WebSocket(url);
    cleanup.push(() => ana.close(), () => bia.close());

    await Promise.all([
      new Promise((resolve) => ana.once('open', resolve)),
      new Promise((resolve) => bia.once('open', resolve))
    ]);

    const createdPromise = waitForMessage(ana, 'room:created');
    const anaJoinedPromise = waitForMessage(ana, 'room:joined');
    ana.send(JSON.stringify({ type: 'room:create', displayName: 'Ana' }));
    const created = await createdPromise;
    const anaJoined = await anaJoinedPromise;

    const biaJoinedPromise = waitForMessage(bia, 'room:joined');
    bia.send(JSON.stringify({ type: 'room:join', roomId: created.roomId, displayName: 'Bia' }));
    const biaJoined = await biaJoinedPromise;

    const leftPromise = waitForMessage(bia, 'participant:left');
    ana.send(JSON.stringify({ type: 'room:leave' }));
    await expect(leftPromise).resolves.toMatchObject({
      type: 'participant:left',
      participantId: anaJoined.participantId
    });

    const biaClosedPromise = new Promise((resolve) => bia.once('close', resolve));
    bia.close();
    await biaClosedPromise;

    const charlie = new WebSocket(url);
    cleanup.push(() => charlie.close());
    await new Promise((resolve) => charlie.once('open', resolve));
    const charlieJoinPromise = waitForMessage(charlie, 'room:not-found');
    charlie.send(JSON.stringify({ type: 'room:join', roomId: created.roomId, displayName: 'Cleo' }));
    await expect(charlieJoinPromise).resolves.toMatchObject({
      type: 'room:not-found',
      roomId: created.roomId
    });
    void biaJoined;
  });

  it('cleans up participant media on leave', async () => {
    const closeParticipantCalls: Array<{ roomId: string; participantId: string }> = [];
    const media: RoomMediaController = {
      start: async () => {},
      stop: async () => {},
      getOrCreateRoom: async () => {
        throw new Error('not used');
      },
      getRouterRtpCapabilities: async () => ({}),
      createTransport: async () => undefined,
      connectTransport: async () => false,
      produce: async () => undefined,
      consume: async () => undefined,
      closeProducer: async () => undefined,
      closeParticipant: async (roomId, participantId) => {
        closeParticipantCalls.push({ roomId, participantId });
        return [{ producerId: 'producer-1', participantId, kind: 'audio', source: 'mic' }];
      },
      closeRoom: async () => {}
    };

    const app = await createApp({ maxParticipantsPerRoom: 20, media });
    await app.listen({ port: 0, host: '127.0.0.1' });
    cleanup.push(() => app.close());
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('missing test address');

    const url = `ws://127.0.0.1:${address.port}/ws`;
    const ana = new WebSocket(url);
    const bia = new WebSocket(url);
    cleanup.push(() => ana.close(), () => bia.close());

    await Promise.all([
      new Promise((resolve) => ana.once('open', resolve)),
      new Promise((resolve) => bia.once('open', resolve))
    ]);

    const createdPromise = waitForMessage(ana, 'room:created');
    const anaJoinedPromise = waitForMessage(ana, 'room:joined');
    ana.send(JSON.stringify({ type: 'room:create', displayName: 'Ana' }));
    const created = await createdPromise;
    const anaJoined = await anaJoinedPromise;

    const biaJoinedPromise = waitForMessage(bia, 'room:joined');
    bia.send(JSON.stringify({ type: 'room:join', roomId: created.roomId, displayName: 'Bia' }));
    await biaJoinedPromise;

    const producerClosedPromise = waitForMessage(bia, 'media:producer-closed');
    ana.send(JSON.stringify({ type: 'room:leave' }));

    await expect(producerClosedPromise).resolves.toMatchObject({
      type: 'media:producer-closed',
      producerId: 'producer-1',
      participantId: anaJoined.participantId
    });
    expect(closeParticipantCalls).toEqual([{ roomId: created.roomId, participantId: anaJoined.participantId }]);
  });
});
