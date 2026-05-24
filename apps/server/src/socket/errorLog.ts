/**
 * 에러 로그 — server socket handler 에러 + 클라 측 에러 보고.
 *
 * 저장처:
 *   - **콘솔** (항상 활성) — `[errorLog]` prefix로 stderr 출력
 *   - **Supabase game_logs** (SUPABASE 설정 시) — type='error' row로 즉시 insert
 *     (게임 단위 buffer X — 게임 외 시점 에러도 잡아야 하므로 즉시 저장)
 *
 * 사용:
 *   - server handler에서 cb({ ok: false, error: ... }) 직전 호출
 *   - client 'client:error' socket 이벤트로 클라 에러 받아 동일 함수 호출
 */

import { supabaseAdmin } from '../lib/supabase.ts';

export interface ErrorLogPayload {
  /** 에러 발생 위치 — 'server:room:join' / 'client:ErrorBoundary' / 'client:toast' 등 */
  source: string;
  /** 사용자 메시지 (toast/cb error 문구) */
  message: string;
  /** 추가 컨텍스트 (요청 payload, stack 일부 등) */
  context?: Record<string, unknown>;
  /** 사용자 식별 (있는 경우만) */
  userId?: string;
  /** 방 식별 (있는 경우만) */
  roomId?: string;
  /** 게임 인스턴스 식별 (방 안 + 게임 진행 중인 경우만) */
  gameInstanceId?: number;
  /** client에서 보고된 에러는 true */
  fromClient?: boolean;
}

const DB_ENABLED = supabaseAdmin !== null;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export function logServerError(payload: ErrorLogPayload): void {
  // 콘솔 — 항상 출력 (production 로그 수집기에서 잡힐 수 있게)
  const tag = payload.fromClient ? '[errorLog:client]' : '[errorLog:server]';
  console.warn(
    `${tag} ${payload.source} — ${payload.message}`,
    payload.context ?? '',
  );

  // DB — 가능하면 즉시 insert (fire-and-forget)
  if (DB_ENABLED) {
    void flushToDb(payload);
  }
}

async function flushToDb(payload: ErrorLogPayload): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    const { error } = await supabaseAdmin.from('game_logs').insert({
      room_id: payload.roomId ?? 'no-room',
      game_instance_id: payload.gameInstanceId ?? 0,
      ts: Date.now(),
      type: 'error',
      payload: {
        source: payload.source,
        message: payload.message,
        context: payload.context ?? null,
        userId: payload.userId ?? null,
        fromClient: payload.fromClient === true,
        env: IS_PRODUCTION ? 'production' : 'development',
      },
    });
    if (error) {
      console.warn('[errorLog] supabase insert failed:', error.message);
    }
  } catch (e) {
    console.warn('[errorLog] supabase insert exception:', e);
  }
}
