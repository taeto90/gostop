import { useEffect, useState } from 'react';

const AFK_THRESHOLD_MS = 30_000;

/**
 * 현재 turn player가 30초+ 응답 없으면 AFK로 간주.
 * `turnUserId`가 변할 때마다 timer 리셋.
 *
 * 클라이언트 단독 — broadcast 없음. 모든 client가 같은 시점에 turn 시작
 * (broadcast 도착 시점)을 기준으로 동일하게 측정.
 *
 * 반환값: AFK 상태로 인식된 userId (없으면 null).
 */
export function useAfkDetect(turnUserId: string | null): string | null {
  const [afkUserId, setAfkUserId] = useState<string | null>(null);

  useEffect(() => {
    setAfkUserId(null);
    if (!turnUserId) return;
    const timer = setTimeout(() => setAfkUserId(turnUserId), AFK_THRESHOLD_MS);
    return () => clearTimeout(timer);
  }, [turnUserId]);

  return afkUserId;
}
