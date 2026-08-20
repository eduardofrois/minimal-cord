import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import { RoomStore } from './rooms/roomStore.js';
import { registerRoomSocket } from './ws/roomSocket.js';

export interface CreateAppOptions {
  maxParticipantsPerRoom: number;
}

export async function createApp(options: CreateAppOptions) {
  const app = Fastify({ logger: true });
  const roomStore = new RoomStore({ maxParticipantsPerRoom: options.maxParticipantsPerRoom });

  await app.register(websocket);

  app.get('/health', async () => ({ ok: true }));
  registerRoomSocket(app, roomStore, options.maxParticipantsPerRoom);

  return app;
}
