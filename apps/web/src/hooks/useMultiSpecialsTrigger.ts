import { useEffect, useRef } from 'react';
import type { RoomView } from '@gostop/shared';
import { useEventOverlayStore } from '../stores/eventOverlayStore.ts';

/**
 * server broadcast 도착 시 마지막 turn의 specials를 EventOverlay로 발화.
 * `view.turnSeq` 변화로 중복 발화 방지.
 */
export function useMultiSpecialsTrigger(view: RoomView): void {
  const lastSeenSeqRef = useRef<number>(view.turnSeq ?? 0);
  useEffect(() => {
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
  }, [view.turnSeq, view.lastTurnSpecials]);
}
