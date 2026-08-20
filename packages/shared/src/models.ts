export type RoomId = string;
export type ParticipantId = string;

export interface Participant {
  id: ParticipantId;
  displayName: string;
  joinedAt: number;
}

export interface RoomSummary {
  id: RoomId;
  participants: Participant[];
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  roomId: RoomId;
  participantId: ParticipantId;
  displayName: string;
  text: string;
  createdAt: number;
}

export interface PublishedTrack {
  producerId: string;
  participantId: ParticipantId;
  source: 'mic' | 'camera' | 'screen';
  kind: 'audio' | 'video';
}
