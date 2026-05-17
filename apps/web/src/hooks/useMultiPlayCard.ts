import { useEffect, useRef, useState } from 'react';
import type { Card, PlayerStateView, RoomView } from '@gostop/shared';
import { emitWithAck } from '../lib/socket.ts';
import { toast } from '../stores/toastStore.ts';
import { buildPrebuildView } from './turnSequence/phaseViews.ts';

interface PendingMultiPick {
  handCardId: string;
  /** 모달에 표시할 카드 (손패 단계면 손패 카드, 더미 단계면 뒤집힌 카드) */
  handCard: Card;
  candidates: Card[];
  stage: 'hand' | 'draw';
  /** stage='draw'일 때 hand 단계에서 이미 선택한 target (재요청용) */
  targetAfterHand?: string;
}

interface UseMultiPlayCardResult {
  pendingPick: PendingMultiPick | null;
  /**
   * needsSelection 응답에서 생성된 prebuild view — useMultiTurnSequence에 input으로 전달.
   * 손패 카드가 바닥에 placed + drawnCard가 바닥에 placed로 보여 Phase 1~3 재생됨.
   * server broadcast (turnSeq 증가) 도착 시 자동 clear.
   */
  prebuildView: RoomView | null;
  emitPlayCard: (
    cardId: string,
    targetAfterHand?: string,
    targetAfterDraw?: string,
    declineBomb?: boolean,
  ) => Promise<void>;
  /** 모달에서 사용자가 카드 선택 시 호출 */
  handlePick: (targetCardId: string) => void;
  cancelPick: () => void;
}

/**
 * 멀티 모드에서 server에 play-card emit + needsSelection 응답 처리.
 *
 * 흐름 (rules-final.md §1-6 정통 매칭 룰 — Phase 3 후 모달):
 * 1. 사용자 카드 클릭 → emit play-card
 * 2. server 응답 needsSelection이면 prebuild view 생성 (손패+더미 카드 바닥에 placed)
 *    → useMultiTurnSequence가 prebuild view 처리 → Phase 1~3 재생
 *    → 외부에서 animationPhase==='idle' + pendingPick 시점에 모달 표시
 * 3. 사용자 선택 → 다시 emit (target 포함)
 * 4. 또 needsSelection이면 또 모달 (이미 prebuild 진행 — 추가 Phase X)
 * 5. 모두 OK면 server commit + broadcast → 진짜 view → Phase 4 (layoutId 자동)
 */
export function useMultiPlayCard(
  myPlayer: PlayerStateView | undefined,
  view: RoomView,
): UseMultiPlayCardResult {
  const [pendingPick, setPendingPick] = useState<PendingMultiPick | null>(null);
  const [prebuildView, setPrebuildView] = useState<RoomView | null>(null);
  const lastTurnSeqRef = useRef<number>(view.turnSeq ?? 0);
  const lastGameIdRef = useRef<number | undefined>(view.gameInstanceId);

  // server broadcast (turnSeq 증가) 또는 새 게임 인스턴스 도착 시 prebuild clear.
  // 새 게임은 hand가 완전히 다르므로 prebuild가 stale.
  useEffect(() => {
    const seq = view.turnSeq ?? 0;
    const gid = view.gameInstanceId;
    if (seq !== lastTurnSeqRef.current || gid !== lastGameIdRef.current) {
      lastTurnSeqRef.current = seq;
      lastGameIdRef.current = gid;
      setPrebuildView(null);
      setPendingPick(null);
    }
  }, [view.turnSeq, view.gameInstanceId]);

  async function emitPlayCard(
    cardId: string,
    targetAfterHand?: string,
    targetAfterDraw?: string,
    declineBomb?: boolean,
  ): Promise<void> {
    const r = await emitWithAck('game:action', {
      type: 'play-card',
      cardId,
      targetAfterHand,
      targetAfterDraw,
      declineBomb,
    });
    if (r.ok) return;
    if ('needsSelection' in r) {
      const handCardObj = myPlayer?.hand?.find((c) => c.id === cardId) ?? null;
      const drawn = r.needsSelection.drawnCard;
      const displayCard =
        r.needsSelection.stage === 'draw' && drawn ? drawn : handCardObj;
      if (!displayCard) {
        toast.error('카드 정보를 찾을 수 없음');
        return;
      }
      // prebuild view 생성 — 첫 emit 시점에만. 재emit 시점엔 이미 prebuild 진행됨.
      if (handCardObj && !prebuildView) {
        setPrebuildView(buildPrebuildView(view, handCardObj, drawn));
      }
      setPendingPick({
        handCardId: cardId,
        handCard: displayCard,
        candidates: r.needsSelection.candidates,
        stage: r.needsSelection.stage,
        targetAfterHand,
      });
    } else if ('error' in r) {
      toast.error(r.error);
    }
  }

  function handlePick(targetCardId: string): void {
    if (!pendingPick) return;
    const pending = pendingPick;
    setPendingPick(null);
    if (pending.stage === 'hand') {
      void emitPlayCard(pending.handCardId, targetCardId);
    } else {
      void emitPlayCard(
        pending.handCardId,
        pending.targetAfterHand,
        targetCardId,
      );
    }
  }

  function cancelPick(): void {
    setPendingPick(null);
    setPrebuildView(null);
  }

  return { pendingPick, prebuildView, emitPlayCard, handlePick, cancelPick };
}

