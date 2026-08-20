import type { ClientMessage, PublishedTrack, ServerMessage } from '@minimal-cord/shared';
import type { RoomMediaController } from './mediasoupService.js';

export interface SignalingContext {
  roomId: string;
  participantId: string;
  media: RoomMediaController;
  send(message: ServerMessage): void;
  broadcast(message: ServerMessage): void;
}

function serializeTransport(transport: {
  id: string;
  iceParameters: unknown;
  iceCandidates: unknown;
  dtlsParameters: unknown;
  sctpParameters: unknown;
}) {
  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
    sctpParameters: transport.sctpParameters
  };
}

function serializeConsumer(consumer: {
  id: string;
  producerId: string;
  kind: 'audio' | 'video';
  rtpParameters: unknown;
}) {
  return {
    id: consumer.id,
    producerId: consumer.producerId,
    kind: consumer.kind,
    rtpParameters: consumer.rtpParameters
  };
}

function isMediaMessage(message: ClientMessage): boolean {
  return message.type.startsWith('media:');
}

export async function handleMediaSignal(message: ClientMessage, context: SignalingContext): Promise<boolean> {
  if (!isMediaMessage(message)) return false;

  switch (message.type) {
    case 'media:get-router-rtp-capabilities': {
      const rtpCapabilities = await context.media.getRouterRtpCapabilities(context.roomId);
      context.send({ type: 'media:router-rtp-capabilities', rtpCapabilities });
      return true;
    }
    case 'media:create-transport': {
      const transport = await context.media.createTransport(context.roomId, message.direction);
      if (!transport) return false;

      context.send({
        type: 'media:transport-created',
        direction: message.direction,
        transportOptions: serializeTransport(transport)
      });
      return true;
    }
    case 'media:connect-transport': {
      const connected = await context.media.connectTransport(context.roomId, message.transportId, message.dtlsParameters);
      if (!connected) return false;

      context.send({ type: 'media:transport-connected', transportId: message.transportId });
      return true;
    }
    case 'media:produce': {
      const producer = await context.media.produce(
        context.roomId,
        message.transportId,
        context.participantId,
        message.kind,
        message.rtpParameters,
        message.source
      );
      if (!producer) return false;

      context.send({ type: 'media:produced', producer });
      context.broadcast({ type: 'media:new-producer', producer });
      return true;
    }
    case 'media:consume': {
      const consumer = await context.media.consume(
        context.roomId,
        message.transportId,
        message.producerId,
        message.rtpCapabilities
      );
      if (!consumer) return false;

      context.send({ type: 'media:consumer-created', consumerOptions: serializeConsumer(consumer) });
      return true;
    }
    case 'media:close-producer': {
      const producer = await context.media.closeProducer(context.roomId, message.producerId);
      if (!producer) return false;

      context.broadcast({ type: 'media:producer-closed', producerId: producer.producerId, participantId: producer.participantId });
      return true;
    }
    default:
      return false;
  }
}
