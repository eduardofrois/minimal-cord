export function getRoomIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/r\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function buildRoomPath(roomId: string): string {
  return `/r/${encodeURIComponent(roomId)}`;
}
