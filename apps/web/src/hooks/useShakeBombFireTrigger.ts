import { useEffect, useRef } from 'react';
import type { RoomView } from '@gostop/shared';
import { useEventOverlayStore } from '../stores/eventOverlayStore.ts';

/**
 * 게임 시작 시점에 어떤 player든 흔들기/폭탄 적용 시 EventOverlay 발화.
 *
 * 본인 모달 응답 전엔 발화 보류 — 본인이 선택 안 했는데 봇 자동 적용으로 화면에
 * 발화되면 사용자 혼란. 본인 detection 있는데 dismissed=false면 전역 발화 X.
 *
 * - 흔들기 (shookMonths 새로 추가) → 'shake'
 * - 폭탄 (bombs 0 → N) → 'bomb'
 * - 폭탄 우선
 */
export function useShakeBombFireTrigger(
  view: RoomView,
  myShakeBombPending: boolean,
): void {
  const seenRef = useRef<Map<string, { shake: number; bomb: number }>>(new Map());
  useEffect(() => {
    if (view.phase !== 'playing') {
      seenRef.current.clear();
      return;
    }
    // 게임 시작 시점 (history 비어있음) — AI 자동 흔들기/폭탄 적용은 시각효과 발화 X
    // (rules-final.md §4 개정 — 흔들기는 게임 도중 발동, 시작 시점 자동 적용은 시각효과 무관)
    const isGameStart = (view.history?.length ?? 0) === 0;
    if (isGameStart) {
      for (const p of view.players) {
        seenRef.current.set(p.userId, {
          shake: p.flags?.shookMonths?.length ?? 0,
          bomb: p.flags?.bombs ?? 0,
        });
      }
      return;
    }
    // 본인 모달 응답 대기 중이면 발화 보류 — 단, seenRef는 갱신해서 응답 후 재발화 방지
    if (myShakeBombPending) {
      for (const p of view.players) {
        const shakeNow = p.flags?.shookMonths?.length ?? 0;
        const bombNow = p.flags?.bombs ?? 0;
        seenRef.current.set(p.userId, { shake: shakeNow, bomb: bombNow });
      }
      return;
    }
    const trigger = useEventOverlayStore.getState().trigger;
    let firedBomb = false;
    let firedShake = false;
    for (const p of view.players) {
      const prev = seenRef.current.get(p.userId) ?? { shake: 0, bomb: 0 };
      const shakeNow = p.flags?.shookMonths?.length ?? 0;
      const bombNow = p.flags?.bombs ?? 0;
      if (bombNow > prev.bomb && !firedBomb) {
        trigger('bomb');
        firedBomb = true;
      } else if (shakeNow > prev.shake && !firedShake && !firedBomb) {
        trigger('shake');
        firedShake = true;
      }
      seenRef.current.set(p.userId, { shake: shakeNow, bomb: bombNow });
    }
  }, [view.phase, view.players, view.history, myShakeBombPending]);
}
