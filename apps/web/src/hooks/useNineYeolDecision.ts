import { useEffect, useRef, useState } from 'react';
import type { PlayerStateView, RoomView } from '@gostop/shared';
import { emitWithAck } from '../lib/socket.ts';
import { toast } from '../stores/toastStore.ts';

/**
 * 9월 열끗(m09-yeol)이 collected에 새로 추가되는 순간 감지 → 모달 mount.
 * 사용자가 끗/쌍피 선택 → `game:toggle-9yeol` emit으로 server에 저장.
 *
 * 새 게임 시작(gameInstanceId 변화) 시 dismissed reset (다시 mount 가능).
 *
 * 정통 한국 룰: 한 게임에 9월 끗은 한 장이라 모달 한 번만 mount.
 */
export function useNineYeolDecision(view: RoomView, myPlayer: PlayerStateView | undefined) {
  const [pending, setPending] = useState(false);
  const prevHadCardRef = useRef<boolean>(false);
  const prevGameIdRef = useRef<number | undefined>(view.gameInstanceId);

  // 새 게임 인스턴스 시작 시 prev 상태 reset
  useEffect(() => {
    if (view.gameInstanceId !== prevGameIdRef.current) {
      prevGameIdRef.current = view.gameInstanceId;
      // 새 게임 시작 시점에 myPlayer.collected에 m09-yeol이 이미 있다면
      // preset 모드 (myCollected 명시) — 모달 mount X (시작부터 보유)
      const hasAtStart = myPlayer?.collected.some((c) => c.id === 'm09-yeol') ?? false;
      prevHadCardRef.current = hasAtStart;
      setPending(false);
    }
  }, [view.gameInstanceId, myPlayer?.collected]);

  // m09-yeol이 본인 collected에 새로 추가되는 순간 감지.
  // **본인 turn 직후** broadcast에서만 trigger — 상대 turn 진행 중 phase별 displayView
  // 변화로 잠시 본인 collected에 m09-yeol이 보이는 경우 (phase4View stealPi 복원 등)
  // 잘못 trigger 방지. lastTurnActorUserId === myUserId일 때만.
  useEffect(() => {
    if (view.phase !== 'playing') return;
    const hasNow = myPlayer?.collected.some((c) => c.id === 'm09-yeol') ?? false;
    const isMyTurnEvent = view.lastTurnActorUserId === view.myUserId;
    if (hasNow && !prevHadCardRef.current && isMyTurnEvent) {
      setPending(true);
    }
    prevHadCardRef.current = hasNow;
  }, [view.phase, view.lastTurnActorUserId, view.myUserId, myPlayer?.collected]);

  async function pick(asSsangPi: boolean) {
    setPending(false);
    const r = await emitWithAck('game:toggle-9yeol', { value: asSsangPi });
    if (!r.ok) toast.error(r.error);
  }

  return { open: pending, pick };
}
