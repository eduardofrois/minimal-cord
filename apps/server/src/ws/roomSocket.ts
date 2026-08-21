import type { FastifyInstance } from 'fastify';
import type { RoomStore } from '../rooms/roomStore.js';
import type { Participant, RoomId } from '@minimal-cord/shared';
import { SocketRegistry } from './socketRegistry.js';
import { parseClientMessage, sendMessage, type SendableSocket } from './messages.js';
import { handleMediaSignal } from '../media/signaling.js';
import type { RoomMediaController } from '../media/mediasoupService.js';

interface RoomSocketConnection extends SendableSocket {
  on(event: 'message', listener: (raw: Buffer | ArrayBuffer | Buffer[] | string) => void): void;
  on(event: 'close', listener: () => void): void;
  close(): void;
}

interface ConnectionState {
  roomId?: RoomId;
  participant?: Participant;
}

function getRoomLimit(roomStore: RoomStore): number {
  return (roomStore as unknown as { options: { maxParticipantsPerRoom: number } }).options.maxParticipantsPerRoom;
}

function sendInvalidMessage(socket: SendableSocket): void {
  sendMessage(socket, { type: 'error', code: 'invalid-message', message: 'Mensagem inválida.' });
}

function sendAlreadyJoined(socket: SendableSocket): void {
  sendMessage(socket, { type: 'error', code: 'already-joined', message: 'Socket already joined a room.' });
}

function rejectIfJoined(registry: SocketRegistry, socket: SendableSocket): boolean {
  if (registry.get(socket)) {
    sendAlreadyJoined(socket);
    return true;
  }

  return false;
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
  if (rejectIfJoined(registry, socket)) return;

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
  if (rejectIfJoined(registry, socket)) return;

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

async function handleClose(roomStore: RoomStore, registry: SocketRegistry, socket: SendableSocket, media: RoomMediaController): Promise<void> {
  const entry = registry.unregister(socket);
  if (!entry) return;

  const closedProducers = await media.closeParticipant(entry.roomId, entry.participantId);
  roomStore.removeParticipant(entry.roomId, entry.participantId);

  for (const producer of closedProducers) {
    registry.broadcastToRoom(entry.roomId, { type: 'media:producer-closed', producerId: producer.producerId, participantId: producer.participantId });
  }

  registry.broadcastToRoomExcept(entry.roomId, entry.participantId, { type: 'participant:left', participantId: entry.participantId });
}

export function registerRoomSocket(app: FastifyInstance, roomStore: RoomStore, media: RoomMediaController): void {
  const registry = new SocketRegistry();

  app.get('/ws', { websocket: true }, (socket: RoomSocketConnection) => {
    const state: ConnectionState = {};

    socket.on('message', (raw) => {
      const message = parseClientMessage(raw);
      if (!message) {
        sendInvalidMessage(socket);
        return;
      }

      if (message.type.startsWith('media:')) {
        const entry = registry.get(socket);
        if (!entry) {
          sendInvalidMessage(socket);
          return;
        }

        void handleMediaSignal(message, {
          roomId: entry.roomId,
          participantId: entry.participantId,
          media,
          send: (response) => sendMessage(socket, response),
          broadcast: (response) => registry.broadcastToRoom(entry.roomId, response)
        })
          .then((handled) => {
            if (!handled) sendInvalidMessage(socket);
          })
          .catch(() => {
            sendInvalidMessage(socket);
          });

        return;
      }

      switch (message.type) {
        case 'room:create':
          createRoom(roomStore, registry, socket, message.displayName, state);
          return;
        case 'room:join':
          joinRoom(roomStore, registry, socket, message.roomId, message.displayName, getRoomLimit(roomStore), state);
          return;
        case 'chat:send':
          handleChat(roomStore, registry, socket, message.text);
          return;
        case 'room:leave':
          void handleClose(roomStore, registry, socket, media).catch(() => {});
          return;
        default:
          sendInvalidMessage(socket);
      }
    });

    socket.on('close', () => {
      void handleClose(roomStore, registry, socket, media).catch(() => {});
    });
  });
}
