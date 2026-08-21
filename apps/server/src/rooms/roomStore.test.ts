import { describe, expect, it, vi } from 'vitest';
import { RoomStore } from './roomStore.js';

function isParticipant(result: ReturnType<RoomStore['addParticipant']>): result is Exclude<ReturnType<RoomStore['addParticipant']>, 'room-not-found' | 'room-full'> {
  return typeof result !== 'string';
}

describe('RoomStore', () => {
  it('creates a temporary room with a random id', () => {
    const store = new RoomStore({ maxParticipantsPerRoom: 20 });
    const room = store.createRoom();

    expect(room.id).toHaveLength(10);
    expect(room.participants).toEqual([]);
    expect(store.getRoom(room.id)?.id).toBe(room.id);
  });

  it('adds and removes participants, deleting empty rooms after the grace window', () => {
    vi.useFakeTimers();

    try {
      const onRoomDeleted = vi.fn();
      const store = new RoomStore({ maxParticipantsPerRoom: 20, emptyRoomGraceMs: 100, onRoomDeleted });
      const room = store.createRoom();
      const participant = store.addParticipant(room.id, 'Ana');

      if (!isParticipant(participant)) {
        throw new Error(`expected participant, got ${participant}`);
      }

      expect(participant?.displayName).toBe('Ana');
      expect(store.getParticipants(room.id)).toHaveLength(1);

      store.removeParticipant(room.id, participant!.id);

      expect(store.getRoom(room.id)).toBeDefined();

      vi.advanceTimersByTime(99);
      expect(store.getRoom(room.id)).toBeDefined();
      expect(onRoomDeleted).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(store.getRoom(room.id)).toBeUndefined();
      expect(onRoomDeleted).toHaveBeenCalledWith(room.id);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels empty-room deletion when someone rejoins during the grace window', () => {
    vi.useFakeTimers();

    try {
      const onRoomDeleted = vi.fn();
      const store = new RoomStore({ maxParticipantsPerRoom: 20, emptyRoomGraceMs: 100, onRoomDeleted });
      const room = store.createRoom();
      const first = store.addParticipant(room.id, 'Ana');

      if (!isParticipant(first)) {
        throw new Error(`expected participant, got ${first}`);
      }

      const message = store.addChatMessage(room.id, first.id, 'Ana', 'oi');
      expect(message?.text).toBe('oi');

      store.removeParticipant(room.id, first.id);
      vi.advanceTimersByTime(50);

      const second = store.addParticipant(room.id, 'Bia');
      expect(isParticipant(second)).toBe(true);

      vi.advanceTimersByTime(100);

      expect(store.getRoom(room.id)).toBeDefined();
      expect(store.getChatMessages(room.id)).toHaveLength(1);
      expect(onRoomDeleted).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects participants when the room is full', () => {
    const store = new RoomStore({ maxParticipantsPerRoom: 1 });
    const room = store.createRoom();
    const first = store.addParticipant(room.id, 'Ana');

    if (!isParticipant(first)) {
      throw new Error(`expected participant, got ${first}`);
    }

    expect(first.displayName).toBe('Ana');
    expect(store.addParticipant(room.id, 'Bia')).toBe('room-full');
  });

  it('stores chat only while the room exists', () => {
    vi.useFakeTimers();

    try {
      const store = new RoomStore({ maxParticipantsPerRoom: 20, emptyRoomGraceMs: 100 });
      const room = store.createRoom();
      const participant = store.addParticipant(room.id, 'Ana');
      if (!isParticipant(participant)) {
        throw new Error(`expected participant, got ${participant}`);
      }
      const message = store.addChatMessage(room.id, participant!.id, 'Ana', 'oi');

      expect(message?.text).toBe('oi');
      expect(store.getChatMessages(room.id)).toHaveLength(1);

      store.removeParticipant(room.id, participant!.id);
      vi.advanceTimersByTime(100);

      expect(store.getChatMessages(room.id)).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});
