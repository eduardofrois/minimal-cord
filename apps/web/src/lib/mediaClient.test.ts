import type { ClientMessage } from '@minimal-cord/shared';
import { describe, expect, it, vi } from 'vitest';

const deviceLoad = vi.fn();

vi.mock('mediasoup-client', () => ({
  Device: class {
    loaded = false;
    rtpCapabilities = { codecs: [] };

    async load(options: unknown) {
      deviceLoad(options);
      this.loaded = true;
    }

    createSendTransport() {
      return { id: 'send-transport', on: vi.fn(), close: vi.fn() };
    }

    createRecvTransport() {
      return {
        id: 'recv-transport',
        on: vi.fn(),
        close: vi.fn(),
        consume: vi.fn(async () => ({ track: { id: 'remote-track' } }))
      };
    }
  }
}));

const { RoomMediaClient } = await import('./mediaClient');

function createClient() {
  const sent: ClientMessage[] = [];
  const socket = { send: (message: ClientMessage) => sent.push(message), close: vi.fn() };
  const client = new RoomMediaClient(socket);

  return { client, socket, sent };
}

describe('RoomMediaClient', () => {
  it('loads the device with the router capabilities', async () => {
    const { client, sent } = createClient();

    const loading = client.load();
    expect(sent).toEqual([{ type: 'media:get-router-rtp-capabilities' }]);

    client.handleMessage({ type: 'media:router-rtp-capabilities', rtpCapabilities: { codecs: ['opus'] } });
    await loading;

    expect(deviceLoad).toHaveBeenCalledWith({ routerRtpCapabilities: { codecs: ['opus'] } });
    expect(client.loaded).toBe(true);
  });

  it('ignores responses that do not match the pending request', async () => {
    const { client } = createClient();

    const recv = client.openRecvTransport();
    client.handleMessage({ type: 'media:transport-created', direction: 'send', transportOptions: { id: 'wrong' } });

    const settled = await Promise.race([recv.then(() => 'settled'), Promise.resolve('pending')]);
    expect(settled).toBe('pending');

    client.handleMessage({ type: 'media:transport-created', direction: 'recv', transportOptions: { id: 'recv-transport' } });
    await expect(recv).resolves.toBeUndefined();
  });

  it('rejects a pending request when the server answers with an error', async () => {
    const { client } = createClient();

    const loading = client.load();
    client.handleMessage({ type: 'error', code: 'media-failed', message: 'Falha no roteador.' });

    await expect(loading).rejects.toThrow('Falha no roteador.');
  });

  it('consumes a remote producer and returns its track', async () => {
    const { client, sent } = createClient();

    const loading = client.load();
    client.handleMessage({ type: 'media:router-rtp-capabilities', rtpCapabilities: {} });
    await loading;

    const recv = client.openRecvTransport();
    client.handleMessage({ type: 'media:transport-created', direction: 'recv', transportOptions: { id: 'recv-transport' } });
    await recv;

    const producer = { producerId: 'p1', participantId: 'other', source: 'mic' as const, kind: 'audio' as const };
    const consuming = client.consume(producer);

    expect(sent.at(-1)).toMatchObject({ type: 'media:consume', transportId: 'recv-transport', producerId: 'p1' });

    // Uma resposta de outro producer não pode resolver esta espera.
    client.handleMessage({ type: 'media:consumer-created', consumerOptions: { producerId: 'p2' } });
    client.handleMessage({ type: 'media:consumer-created', consumerOptions: { producerId: 'p1', id: 'c1' } });

    await expect(consuming).resolves.toMatchObject({ producerId: 'p1', participantId: 'other' });
  });
});
