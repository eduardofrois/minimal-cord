import { isClientMessage, type ClientMessage, type ServerMessage } from '@minimal-cord/shared';

function rawToString(raw: Buffer | ArrayBuffer | Buffer[] | string): string {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return Buffer.concat(raw).toString();
  if (raw instanceof ArrayBuffer) return Buffer.from(raw).toString();
  return raw.toString();
}

export function parseClientMessage(raw: Buffer | ArrayBuffer | Buffer[] | string): ClientMessage | undefined {
  try {
    const value = JSON.parse(rawToString(raw));
    return isClientMessage(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export interface SendableSocket {
  readyState: number;
  send(data: string): void;
}

export function sendMessage(socket: SendableSocket, message: ServerMessage): void {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(message));
  }
}
