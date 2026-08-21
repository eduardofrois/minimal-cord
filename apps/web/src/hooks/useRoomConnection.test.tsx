import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ServerMessage } from '@minimal-cord/shared';
import { useRoomConnection } from './useRoomConnection';

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
      act(() => {
        onMessage?.(message);
      });
    }
  };
}

describe('useRoomConnection', () => {
  it('joins the room as soon as the socket is created', () => {
    const socket = createConnectStub();

    renderHook(() => useRoomConnection({ roomId: 'room1', displayName: 'Ana', connect: socket.connect }));

    expect(socket.send).toHaveBeenCalledWith({ type: 'room:join', roomId: 'room1', displayName: 'Ana' });
  });

  it('adds chat messages received from the socket', () => {
    const socket = createConnectStub();

    const { result } = renderHook(() => useRoomConnection({ roomId: 'room1', displayName: 'Ana', connect: socket.connect }));

    socket.emit({
      type: 'chat:message',
      message: { id: 'm1', roomId: 'room1', participantId: 'p1', displayName: 'Ana', text: 'oi', createdAt: 1 }
    });

    expect(result.current.chatMessages).toHaveLength(1);
    expect(result.current.chatMessages[0].text).toBe('oi');
  });

  it('tracks participants joining and leaving', () => {
    const socket = createConnectStub();

    const { result } = renderHook(() => useRoomConnection({ roomId: 'room1', displayName: 'Ana', connect: socket.connect }));

    socket.emit({
      type: 'room:joined',
      roomId: 'room1',
      participantId: 'p1',
      participants: [{ id: 'p1', displayName: 'Ana', joinedAt: 1 }],
      chatMessages: []
    });
    socket.emit({ type: 'participant:joined', participant: { id: 'p2', displayName: 'Bruno', joinedAt: 2 } });

    expect(result.current.participantId).toBe('p1');
    expect(result.current.participants.map((participant) => participant.displayName)).toEqual(['Ana', 'Bruno']);

    socket.emit({ type: 'participant:left', participantId: 'p1' });

    expect(result.current.participants.map((participant) => participant.displayName)).toEqual(['Bruno']);
  });

  it('reports rejected joins as errors', () => {
    const socket = createConnectStub();

    const { result } = renderHook(() => useRoomConnection({ roomId: 'room1', displayName: 'Ana', connect: socket.connect }));

    socket.emit({ type: 'room:not-found', roomId: 'room1' });

    expect(result.current.error).toMatch(/não encontrada/i);
  });

  it('closes the socket on unmount', () => {
    const socket = createConnectStub();

    const { unmount } = renderHook(() => useRoomConnection({ roomId: 'room1', displayName: 'Ana', connect: socket.connect }));
    unmount();

    expect(socket.close).toHaveBeenCalled();
  });
});
