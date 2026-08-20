import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import { RoomStore } from './rooms/roomStore.js';
import { MediasoupService, parseMediasoupConfig, type RoomMediaController } from './media/mediasoupService.js';
import { registerRoomSocket } from './ws/roomSocket.js';

export interface CreateAppOptions {
  maxParticipantsPerRoom: number;
  media?: RoomMediaController;
}

export async function createApp(options: CreateAppOptions) {
  const app = Fastify({ logger: true });
  const roomStore = new RoomStore({ maxParticipantsPerRoom: options.maxParticipantsPerRoom });
  const media = options.media ?? new MediasoupService(parseMediasoupConfig());

  await app.register(websocket);

  app.get('/health', async () => ({ ok: true }));
  app.addHook('onClose', async () => {
    await media.stop();
  });

  await media.start();
  registerRoomSocket(app, roomStore, media);

  return app;
}
