import type { FastifyInstance } from 'fastify';
import type { RoomStore } from '../rooms/roomStore.js';
import type { Participant, RoomId } from '@minimal-cord/shared';
import { SocketRegistry } from './socketRegistry.js';
import { parseClientMessage, sendMessage, type SendableSocket } from './messages.js';

interface RoomSocketConnection extends SendableSocket {
  on(event: 'message', listener: (raw: Buffer | ArrayBuffer | Buffer[] | string) => void): void;
  on(event: 'close', listener: () => void): void;
  close(): void;
}

interface ConnectionState {
  roomId?: RoomId;
  participant?: Participant;
}

function sendInvalidMessage(socket: SendableSocket): void {
  sendMessage(socket, { type: 'error', code: 'invalid-message', message: 'Mensagem inválida.' });
}

function sendJoined(socket: SendableSocket, roomId: RoomId, participantId: string, roomStore: RoomStore): void {
  sendMessage(socket, {
    type: 'room:joined',
    roomId,
    participantId,
    participants: roomStore.getParticipants(roomId),
    chatMessages: roomStore.getChatMessages(roomId)
  });
}

function createRoom(roomStore: RoomStore, registry: SocketRegistry, socket: SendableSocket, displayName: string, state: ConnectionState): void {
  const room = roomStore.createRoom();
  const participant = roomStore.addParticipant(room.id, displayName);

  if (typeof participant === 'string') {
    sendInvalidMessage(socket);
    return;
  }

  state.roomId = room.id;
  state.participant = participant;
  registry.register(socket, room.id, participant.id);

  sendMessage(socket, { type: 'room:created', roomId: room.id });
  sendJoined(socket, room.id, participant.id, roomStore);
}

function joinRoom(roomStore: RoomStore, registry: SocketRegistry, socket: SendableSocket, roomId: RoomId, displayName: string, roomLimit: number, state: ConnectionState): void {
  const result = roomStore.addParticipant(roomId, displayName);

  if (result === 'room-not-found') {
    sendMessage(socket, { type: 'room:not-found', roomId });
    return;
  }

  if (result === 'room-full') {
    sendMessage(socket, { type: 'room:full', roomId, limit: roomLimit });
    return;
  }

  state.roomId = roomId;
  state.participant = result;
  registry.register(socket, roomId, result.id);

  sendJoined(socket, roomId, result.id, roomStore);
  registry.broadcastToRoomExcept(roomId, result.id, { type: 'participant:joined', participant: result });
}

function handleChat(roomStore: RoomStore, registry: SocketRegistry, socket: SendableSocket, text: string): void {
  const entry = registry.get(socket);
  if (!entry) return;

  const participant = roomStore.getParticipants(entry.roomId).find((candidate) => candidate.id === entry.participantId);
  if (!participant) return;

  const message = roomStore.addChatMessage(entry.roomId, participant.id, participant.displayName, text);
  if (!message) return;

  registry.broadcastToRoom(entry.roomId, { type: 'chat:message', message });
}

function handleClose(roomStore: RoomStore, registry: SocketRegistry, socket: SendableSocket): void {
  const entry = registry.unregister(socket);
  if (!entry) return;

  registry.broadcastToRoomExcept(entry.roomId, entry.participantId, { type: 'participant:left', participantId: entry.participantId });
  roomStore.removeParticipant(entry.roomId, entry.participantId);
}

export function registerRoomSocket(app: FastifyInstance, roomStore: RoomStore, roomLimit: number): void {
  const registry = new SocketRegistry();

  app.get('/ws', { websocket: true }, (socket: RoomSocketConnection) => {
    const state: ConnectionState = {};

    socket.on('message', (raw) => {
      const message = parseClientMessage(raw);
      if (!message) {
        sendInvalidMessage(socket);
        return;
      }

      switch (message.type) {
        case 'room:create':
          createRoom(roomStore, registry, socket, message.displayName, state);
          return;
        case 'room:join':
          joinRoom(roomStore, registry, socket, message.roomId, message.displayName, roomLimit, state);
          return;
        case 'chat:send':
          handleChat(roomStore, registry, socket, message.text);
          return;
        case 'room:leave':
          handleClose(roomStore, registry, socket);
          return;
        default:
          sendInvalidMessage(socket);
      }
    });

    socket.on('close', () => {
      handleClose(roomStore, registry, socket);
    });
  });
}
