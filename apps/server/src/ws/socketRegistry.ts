import type { ServerMessage } from '@minimal-cord/shared';
import type { SendableSocket } from './messages.js';
import { sendMessage } from './messages.js';

interface SocketEntry {
  socket: SendableSocket;
  roomId: string;
  participantId: string;
}

export class SocketRegistry {
  private readonly entries = new Map<SendableSocket, SocketEntry>();

  register(socket: SendableSocket, roomId: string, participantId: string): void {
    this.entries.set(socket, { socket, roomId, participantId });
  }

  unregister(socket: SendableSocket): SocketEntry | undefined {
    const entry = this.entries.get(socket);
    this.entries.delete(socket);
    return entry;
  }

  get(socket: SendableSocket): SocketEntry | undefined {
    return this.entries.get(socket);
  }

  broadcastToRoom(roomId: string, message: ServerMessage): void {
    for (const entry of this.entries.values()) {
      if (entry.roomId === roomId) sendMessage(entry.socket, message);
    }
  }

  broadcastToRoomExcept(roomId: string, exceptParticipantId: string, message: ServerMessage): void {
    for (const entry of this.entries.values()) {
      if (entry.roomId === roomId && entry.participantId !== exceptParticipantId) {
        sendMessage(entry.socket, message);
      }
    }
  }
}
