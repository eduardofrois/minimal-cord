import { buildRoomPath } from './roomLink';
import { buildRoomSocketUrl, connectRoomSocket, type ConnectRoomSocket } from './wsClient';

export type CreateRoomOptions = {
  displayName: string;
  connect?: ConnectRoomSocket;
  location?: Pick<Location, 'protocol' | 'host'>;
};

export type CreateRoomResult = {
  roomId: string;
  path: string;
};

export function createRoom({ displayName, connect = connectRoomSocket, location = window.location }: CreateRoomOptions): Promise<CreateRoomResult> {
  const trimmedDisplayName = displayName.trim();

  return new Promise((resolve, reject) => {
    const socket = connect(buildRoomSocketUrl(location), (message) => {
      switch (message.type) {
        case 'room:created':
          socket.close();
          resolve({ roomId: message.roomId, path: buildRoomPath(message.roomId) });
          return;
        case 'error':
          socket.close();
          reject(new Error(message.message));
          return;
        default:
      }
    });

    if (!trimmedDisplayName) {
      socket.close();
      reject(new Error('Informe seu nome para continuar.'));
      return;
    }

    socket.send({ type: 'room:create', displayName: trimmedDisplayName });
  });
}
