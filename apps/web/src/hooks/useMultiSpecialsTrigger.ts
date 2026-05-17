import { useEffect, useRef } from 'react';
import type { RoomView } from '@gostop/shared';
import type { AnimationPhase } from '../lib/animationContext.ts';
import { useEventOverlayStore } from '../stores/eventOverlayStore.ts';

/**
 * 4-phase 카드 비행 시퀀스 완료 후 마지막 turn의 specials를 EventOverlay로 발화.
 *
 * 이전: view.turnSeq 변경 즉시 발화 → 손패 비행 시작 전에 쪽/뻑이 표시되어 부자연.
 * 현재: phase가 'idle'일 때만 발화 → sequence 끝난 후 자연스럽게 표시.
 *
 * @param phase useMultiTurnSequence의 currentPhase (idle/phase1/phase3/phase4)
 */
export function useMultiSpecialsTrigger(
  view: RoomView,
  phase: AnimationPhase = 'idle',
): void {
  const lastSeenSeqRef = useRef<number>(view.turnSeq ?? 0);
  useEffect(() => {
    // phase4 = view swap 완료 시점이라 trigger 가능. idle은 sequence 끝 후.
    // 둘 다 허용 — phase4 → phase3 같은 batch로 빠르게 전환되어 idle 단계가 짧을 때도 발화 보장.
    if (phase !== 'phase4' && phase !== 'idle') return;
    const seq = view.turnSeq ?? 0;
    if (seq === lastSeenSeqRef.current) return;
    lastSeenSeqRef.current = seq;
    const sp = view.lastTurnSpecials;
    if (!sp) return;
    const trigger = useEventOverlayStore.getState().trigger;
    // 우선순위: 폭탄 > 따닥 > 자뻑 > 쪽 > 싹쓸이 > 뻑
    if (sp.bomb) trigger('bomb');
    else if (sp.ttadak) trigger('ttadak');
    else if (sp.recoveredMonth !== undefined && sp.isOwnRecover) trigger('ja-ppeok');
    else if (sp.jjok) trigger('jjok');
    else if (sp.sweep) trigger('sweep');
    else if (sp.ppeokMonth !== undefined) trigger('ppeok');
  }, [view.turnSeq, view.lastTurnSpecials, phase]);
}
