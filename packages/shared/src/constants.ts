export const DEFAULT_MAX_PARTICIPANTS = 20;
export const ROOM_ID_LENGTH = 10;
export const MAX_DISPLAY_NAME_LENGTH = 40;
export const MAX_CHAT_TEXT_LENGTH = 1000;

export const MEDIA_KINDS = ['audio', 'video'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_SOURCES = ['mic', 'camera', 'screen'] as const;
export type MediaSource = (typeof MEDIA_SOURCES)[number];
