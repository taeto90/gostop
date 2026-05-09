import { useState } from 'react';
import type { Card, PlayerStateView } from '@gostop/shared';
import { emitWithAck } from '../lib/socket.ts';
import { toast } from '../stores/toastStore.ts';

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
  emitPlayCard: (
    cardId: string,
    targetAfterHand?: string,
    targetAfterDraw?: string,
  ) => Promise<void>;
  /** 모달에서 사용자가 카드 선택 시 호출 */
  handlePick: (targetCardId: string) => void;
  cancelPick: () => void;
}

/**
 * 멀티 모드에서 server에 play-card emit + needsSelection 응답 처리.
 *
 * 흐름 (rules-final.md §1-6 정통 매칭 룰):
 * 1. 사용자 카드 클릭 → emit play-card
 * 2. server 응답 needsSelection이면 모달 띄움 (Phase 3 후)
 * 3. 사용자 선택 → 다시 emit (target 포함)
 * 4. 또 needsSelection이면 또 모달 (손패 → 더미 단계)
 * 5. 모두 OK면 server commit + broadcast
 */
export function useMultiPlayCard(
  myPlayer: PlayerStateView | undefined,
): UseMultiPlayCardResult {
  const [pendingPick, setPendingPick] = useState<PendingMultiPick | null>(null);

  async function emitPlayCard(
    cardId: string,
    targetAfterHand?: string,
    targetAfterDraw?: string,
  ): Promise<void> {
    const r = await emitWithAck('game:action', {
      type: 'play-card',
      cardId,
      targetAfterHand,
      targetAfterDraw,
    });
    if (r.ok) return;
    if ('needsSelection' in r) {
      const handCardObj = myPlayer?.hand?.find((c) => c.id === cardId) ?? null;
      const displayCard =
        r.needsSelection.stage === 'draw' && r.needsSelection.drawnCard
          ? r.needsSelection.drawnCard
          : handCardObj;
      if (!displayCard) {
        toast.error('카드 정보를 찾을 수 없음');
        return;
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
  }

  return { pendingPick, emitPlayCard, handlePick, cancelPick };
}
