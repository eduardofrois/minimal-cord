import { describe, expect, it, vi } from 'vitest';
import { createRoom } from './createRoom';
import type { ServerMessage } from '@minimal-cord/shared';

function createConnectStub() {
  const send = vi.fn();
  const close = vi.fn();
  let onMessage: ((message: ServerMessage) => void) | undefined;

  const connect = vi.fn((_url: string, handler: (message: ServerMessage) => void) => {
    onMessage = handler;
    return { send, close };
  });

  return {
    connect,
    send,
    close,
    emit(message: ServerMessage) {
      onMessage?.(message);
    }
  };
}

describe('createRoom', () => {
  it('creates a room and resolves with the room path', async () => {
    const socket = createConnectStub();

    const promise = createRoom({
      displayName: ' Ana ',
      connect: socket.connect,
      location: { protocol: 'http:', host: 'example.com' }
    });

    expect(socket.connect).toHaveBeenCalledWith('ws://example.com/ws', expect.any(Function));
    expect(socket.send).toHaveBeenCalledWith({ type: 'room:create', displayName: 'Ana' });

    socket.emit({ type: 'room:created', roomId: 'abc123' });

    await expect(promise).resolves.toEqual({ roomId: 'abc123', path: '/r/abc123' });
    expect(socket.close).toHaveBeenCalled();
  });

  it('rejects when the server answers with an error', async () => {
    const socket = createConnectStub();

    const promise = createRoom({
      displayName: 'Ana',
      connect: socket.connect,
      location: { protocol: 'https:', host: 'example.com' }
    });

    socket.emit({ type: 'error', code: 'room-create-failed', message: 'Falha ao criar a sala.' });

    await expect(promise).rejects.toThrow('Falha ao criar a sala.');
    expect(socket.close).toHaveBeenCalled();
  });
});
