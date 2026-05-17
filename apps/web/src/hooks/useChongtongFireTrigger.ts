import { useEffect, useRef } from 'react';
import type { RoomView } from '@gostop/shared';
import { useEventOverlayStore } from '../stores/eventOverlayStore.ts';

/**
 * 게임 시작 시점에 총통(시작 손패 같은 월 4장)이 발동되면 EventOverlay '총통' 발화.
 *
 * 모든 player(본인 + 봇 + 상대)의 클라가 chongtongUserId 변화를 감지해 동시에 발화.
 * - null → userId: 발화
 * - gameInstanceId 변화 시 ref 자동 reset (새 게임)
 */
export function useChongtongFireTrigger(view: RoomView): void {
  const lastSeenInstanceRef = useRef<number | undefined>(undefined);
  const firedRef = useRef<boolean>(false);

  useEffect(() => {
    // 새 게임 시작 — fired flag reset
    if (lastSeenInstanceRef.current !== view.gameInstanceId) {
      lastSeenInstanceRef.current = view.gameInstanceId;
      firedRef.current = false;
    }
    if (view.chongtongUserId && !firedRef.current) {
      firedRef.current = true;
      useEventOverlayStore.getState().trigger('chongtong');
    }
  }, [view.gameInstanceId, view.chongtongUserId]);
}
