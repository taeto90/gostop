import { useEffect, useState } from 'react';

/**
 * 본인 턴일 때 카운트다운을 진행하고, 시간 초과 시 onTimeout 호출.
 *
 * - turnLimitSec === 0이면 비활성 (remaining = null 반환)
 * - 본인 턴이 바뀔 때마다 reset
 *
 * @returns 남은 초 (0이면 timeout 직전, null이면 비활성)
 */
export function useTurnTimer(
  isMyTurn: boolean,
  turnPlayerId: string | null,
  turnLimitSec: number,
  onTimeout: () => void,
): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!isMyTurn || turnLimitSec <= 0 || !turnPlayerId) {
      setRemaining(null);
      return;
    }

    setRemaining(turnLimitSec);
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r === null) return null;
        if (r <= 1) {
          clearInterval(interval);
          onTimeout();
          return 0;
        }
        return r - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
    // turnPlayerId 변경 = 새 턴. 매 턴 reset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, turnPlayerId, turnLimitSec]);

  return remaining;
}
