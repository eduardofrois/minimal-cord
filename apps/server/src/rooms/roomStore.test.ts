import { describe, expect, it } from 'vitest';
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

  it('adds and removes participants, deleting empty rooms', () => {
    const store = new RoomStore({ maxParticipantsPerRoom: 20 });
    const room = store.createRoom();
    const participant = store.addParticipant(room.id, 'Ana');

    if (!isParticipant(participant)) {
      throw new Error(`expected participant, got ${participant}`);
    }

    expect(participant?.displayName).toBe('Ana');
    expect(store.getParticipants(room.id)).toHaveLength(1);

    store.removeParticipant(room.id, participant!.id);

    expect(store.getRoom(room.id)).toBeUndefined();
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
    const store = new RoomStore({ maxParticipantsPerRoom: 20 });
    const room = store.createRoom();
    const participant = store.addParticipant(room.id, 'Ana');
    if (!isParticipant(participant)) {
      throw new Error(`expected participant, got ${participant}`);
    }
    const message = store.addChatMessage(room.id, participant!.id, 'Ana', 'oi');

    expect(message?.text).toBe('oi');
    expect(store.getChatMessages(room.id)).toHaveLength(1);

    store.removeParticipant(room.id, participant!.id);

    expect(store.getChatMessages(room.id)).toEqual([]);
  });
});
