import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@gostop/shared';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000';

let socketInstance: GameSocket | null = null;

export function getSocket(): GameSocket {
  if (!socketInstance) {
    socketInstance = io(SERVER_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    });
  }
  return socketInstance;
}

export function connectSocket(): void {
  const socket = getSocket();
  if (!socket.connected) socket.connect();
}

export function updateSocketToken(token: string): void {
  const socket = getSocket();
  socket.auth = { token };
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

export function emitWithAck<E extends keyof ClientToServerEvents>(
  event: E,
  ...args: Parameters<ClientToServerEvents[E]> extends [...infer Rest, infer _Cb] ? Rest : never
): Promise<
  Parameters<ClientToServerEvents[E]> extends [...infer _Rest, (result: infer R) => void]
    ? R
    : never
> {
  return new Promise((resolve) => {
    const socket = getSocket();
    (socket.emit as (...a: unknown[]) => void)(event, ...args, (result: unknown) => {
      resolve(result as never);
    });
  });
}
