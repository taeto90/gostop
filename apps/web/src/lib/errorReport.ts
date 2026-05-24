/**
 * 에러 보고 helper — server `client:error` socket emit.
 *
 * - `reportError({ source, message, context? })` 호출 시 server에 즉시 emit (fire-and-forget)
 * - server는 game_logs(type='error')에 insert + console.warn
 * - socket 연결 안 됐으면 무시 (큐잉 X — 첫 에러가 보통 연결 직후 발생)
 */

import { getSocket } from './socket.ts';
import { useSessionStore } from '../stores/sessionStore.ts';

let lastReportedKey = '';
let lastReportedAt = 0;
const DEDUP_WINDOW_MS = 3000;

export function reportError(payload: {
  source: string;
  message: string;
  context?: Record<string, unknown>;
  roomId?: string;
}): void {
  // 같은 source+message가 3초 안에 반복되면 skip (toast spam 방지)
  const key = `${payload.source}|${payload.message}`;
  const now = Date.now();
  if (key === lastReportedKey && now - lastReportedAt < DEDUP_WINDOW_MS) return;
  lastReportedKey = key;
  lastReportedAt = now;

  try {
    const profile = useSessionStore.getState().profile;
    const s = getSocket();
    if (!s.connected) return;
    s.emit('client:error', {
      source: payload.source,
      message: payload.message,
      context: payload.context,
      userId: profile?.userId,
      roomId: payload.roomId,
    });
  } catch {
    // socket emit 자체가 실패하면 재시도 X (무한 루프 방지)
  }
}
