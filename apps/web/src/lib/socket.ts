import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@gostop/shared';
import { supabase } from './supabase.ts';

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

/** Auth 완료 후 호출 — JWT 토큰 설정 + 연결 시작 */
export async function connectWithAuth(): Promise<void> {
  const socket = getSocket();
  if (!supabase) {
    socket.connect();
    return;
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    socket.auth = { token };
  }
  if (!socket.connected) {
    socket.connect();
  }
}

/** 토큰 갱신 시 socket auth 업데이트 (재연결 시 자동 사용) */
export function updateSocketToken(token: string): void {
  const socket = getSocket();
  socket.auth = { token };
}

/** 로그아웃 시 소켓 완전 해제 */
export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

/**
 * Promise 래퍼: 콜백 기반 socket emit을 await 가능하게 변환.
 */
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
