import {
  MAX_CHAT_TEXT_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  ROOM_ID_LENGTH,
  type ChatMessage,
  type Participant,
  type RoomId,
  type RoomSummary
} from '@minimal-cord/shared';
import { nanoid } from 'nanoid';

interface StoredRoom {
  id: RoomId;
  createdAt: number;
  participants: Map<string, Participant>;
  chatMessages: ChatMessage[];
}

export interface RoomStoreOptions {
  maxParticipantsPerRoom: number;
  emptyRoomGraceMs?: number;
  onRoomDeleted?: (roomId: RoomId) => void;
}

export type AddParticipantResult = Participant | 'room-not-found' | 'room-full';

export class RoomStore {
  private readonly rooms = new Map<RoomId, StoredRoom>();
  private readonly emptyRoomTimers = new Map<RoomId, ReturnType<typeof setTimeout>>();

  constructor(private readonly options: RoomStoreOptions) {}

  createRoom(): RoomSummary {
    const room: StoredRoom = {
      id: nanoid(ROOM_ID_LENGTH),
      createdAt: Date.now(),
      participants: new Map(),
      chatMessages: []
    };

    this.rooms.set(room.id, room);
    return this.toSummary(room);
  }

  getRoom(roomId: RoomId): RoomSummary | undefined {
    const room = this.rooms.get(roomId);
    return room ? this.toSummary(room) : undefined;
  }

  getParticipants(roomId: RoomId): Participant[] {
    return [...(this.rooms.get(roomId)?.participants.values() ?? [])];
  }

  getChatMessages(roomId: RoomId): ChatMessage[] {
    return [...(this.rooms.get(roomId)?.chatMessages ?? [])];
  }

  addParticipant(roomId: RoomId, displayName: string): AddParticipantResult {
    const room = this.rooms.get(roomId);
    if (!room) return 'room-not-found';
    if (room.participants.size >= this.options.maxParticipantsPerRoom) return 'room-full';

    const emptyRoomTimer = this.emptyRoomTimers.get(roomId);
    if (emptyRoomTimer) {
      clearTimeout(emptyRoomTimer);
      this.emptyRoomTimers.delete(roomId);
    }

    const participant: Participant = {
      id: nanoid(),
      displayName: displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH),
      joinedAt: Date.now()
    };

    room.participants.set(participant.id, participant);
    return participant;
  }

  removeParticipant(roomId: RoomId, participantId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.participants.delete(participantId);

    if (room.participants.size === 0) {
      if (this.emptyRoomTimers.has(roomId)) return;

      const graceMs = this.options.emptyRoomGraceMs ?? 30_000;
      const timer = setTimeout(() => {
        const currentRoom = this.rooms.get(roomId);
        this.emptyRoomTimers.delete(roomId);

        if (!currentRoom || currentRoom.participants.size > 0) return;

        this.rooms.delete(roomId);
        this.options.onRoomDeleted?.(roomId);
      }, graceMs);

      this.emptyRoomTimers.set(roomId, timer);
    }
  }

  addChatMessage(roomId: RoomId, participantId: string, displayName: string, text: string): ChatMessage | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    const messageText = text.trim().slice(0, MAX_CHAT_TEXT_LENGTH);
    if (messageText.length === 0) return undefined;

    const message: ChatMessage = {
      id: nanoid(),
      roomId,
      participantId,
      displayName,
      text: messageText,
      createdAt: Date.now()
    };

    room.chatMessages.push(message);
    return message;
  }

  private toSummary(room: StoredRoom): RoomSummary {
    return {
      id: room.id,
      createdAt: room.createdAt,
      participants: [...room.participants.values()]
    };
  }
}
