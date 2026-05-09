import { useEffect, useState } from 'react';
import type { RoomView } from '@gostop/shared';

/**
 * server broadcast의 `turnStartedAt` + `currentTurnLimitSec`을 기준으로
 * 모든 player turn에 대한 카운트다운을 계산한다.
 *
 * - server-side timer가 자동 발동을 처리. 클라는 표시만.
 * - 모든 client가 동일한 시점 기준 (turnStartedAt) 사용 → 일관된 카운트.
 * - turnStartedAt 없거나 currentTurnLimitSec=0이면 null 반환.
 *
 * @returns 남은 초 (정수, >= 0). null이면 카운트다운 비활성.
 */
export function useAnyTurnCountdown(view: RoomView): number | null {
  const turnStartedAt = view.turnStartedAt;
  const limitSec = view.currentTurnLimitSec ?? 0;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!turnStartedAt || limitSec <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [turnStartedAt, limitSec]);

  if (!turnStartedAt || limitSec <= 0) return null;
  const elapsed = (now - turnStartedAt) / 1000;
  const remaining = Math.max(0, Math.ceil(limitSec - elapsed));
  return remaining;
}
