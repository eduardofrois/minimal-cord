import type { ChatMessage, Participant, PublishedTrack, RoomId } from './models.js';

export type ClientMessage =
  | { type: 'room:create'; displayName: string }
  | { type: 'room:join'; roomId: RoomId; displayName: string }
  | { type: 'room:leave' }
  | { type: 'chat:send'; text: string }
  | { type: 'media:get-router-rtp-capabilities' }
  | { type: 'media:create-transport'; direction: 'send' | 'recv' }
  | { type: 'media:connect-transport'; transportId: string; dtlsParameters: unknown }
  | { type: 'media:produce'; transportId: string; kind: 'audio' | 'video'; rtpParameters: unknown; source: 'mic' | 'camera' | 'screen' }
  | { type: 'media:consume'; producerId: string; rtpCapabilities: unknown }
  | { type: 'media:close-producer'; producerId: string };

export type ServerMessage =
  | { type: 'room:created'; roomId: RoomId }
  | { type: 'room:joined'; roomId: RoomId; participantId: string; participants: Participant[]; chatMessages: ChatMessage[] }
  | { type: 'room:not-found'; roomId: RoomId }
  | { type: 'room:full'; roomId: RoomId; limit: number }
  | { type: 'participant:joined'; participant: Participant }
  | { type: 'participant:left'; participantId: string }
  | { type: 'chat:message'; message: ChatMessage }
  | { type: 'media:router-rtp-capabilities'; rtpCapabilities: unknown }
  | { type: 'media:transport-created'; direction: 'send' | 'recv'; transportOptions: unknown }
  | { type: 'media:transport-connected'; transportId: string }
  | { type: 'media:produced'; producer: PublishedTrack }
  | { type: 'media:producer-closed'; producerId: string; participantId: string }
  | { type: 'media:new-producer'; producer: PublishedTrack }
  | { type: 'media:consumer-created'; consumerOptions: unknown }
  | { type: 'error'; code: string; message: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasNonEmptyString(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === 'string' && value[key].trim().length > 0;
}

export function isClientMessage(value: unknown): value is ClientMessage {
  if (!isObject(value) || typeof value.type !== 'string') return false;

  switch (value.type) {
    case 'room:create':
      return hasNonEmptyString(value, 'displayName');
    case 'room:join':
      return hasNonEmptyString(value, 'roomId') && hasNonEmptyString(value, 'displayName');
    case 'room:leave':
    case 'media:get-router-rtp-capabilities':
      return true;
    case 'chat:send':
      return hasNonEmptyString(value, 'text');
    case 'media:create-transport':
      return value.direction === 'send' || value.direction === 'recv';
    case 'media:connect-transport':
      return hasNonEmptyString(value, 'transportId') && 'dtlsParameters' in value;
    case 'media:produce':
      return hasNonEmptyString(value, 'transportId') && (value.kind === 'audio' || value.kind === 'video') && (value.source === 'mic' || value.source === 'camera' || value.source === 'screen') && 'rtpParameters' in value;
    case 'media:consume':
      return hasNonEmptyString(value, 'producerId') && 'rtpCapabilities' in value;
    case 'media:close-producer':
      return hasNonEmptyString(value, 'producerId');
    default:
      return false;
  }
}
