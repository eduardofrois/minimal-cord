import { afterEach, describe, expect, it } from 'vitest';
import WebSocket, { type RawData } from 'ws';
import { createApp } from '../app.js';

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
  const app = await createApp({ maxParticipantsPerRoom: 20 });
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
});
