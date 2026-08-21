import type { ClientMessage, ServerMessage } from '@minimal-cord/shared';

export interface RoomSocket {
  send(message: ClientMessage): void;
  close(): void;
}

export type ConnectRoomSocket = (url: string, onMessage: (message: ServerMessage) => void) => RoomSocket;

export function buildRoomSocketUrl(location: Pick<Location, 'protocol' | 'host'>): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';

  return `${protocol}//${location.host}/ws`;
}

export const connectRoomSocket: ConnectRoomSocket = (url, onMessage) => {
  const socket = new WebSocket(url);

  socket.addEventListener('message', (event) => {
    try {
      onMessage(JSON.parse(event.data) as ServerMessage);
    } catch {
      // Ignora frames que não são JSON do protocolo.
    }
  });

  return {
    send(message) {
      const data = JSON.stringify(message);

      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
        return;
      }

      socket.addEventListener('open', () => socket.send(data), { once: true });
    },
    close() {
      socket.close();
    }
  };
};
