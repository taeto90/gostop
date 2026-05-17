/**
 * 서버측 AI 봇 턴 자동 진행 (B.19).
 *
 * - room.game.turnPlayerId가 AI 봇이면 setTimeout 후 chooseAiCard + executeTurn 호출
 * - 결과 broadcast + 다음 턴이 또 AI면 재귀
 * - room이 살아있고 phase === 'playing'일 때만 동작
 */

import type { Room } from '@gostop/shared';
import {
  awardBombBonusCards,
  calculateScore,
  chooseAiCard,
  executeTurn,
} from '@gostop/shared';

import type { RoomStore } from '../rooms/RoomStore.ts';
import { findPlayer } from '../rooms/playerOps.ts';
import { broadcastRoomState, type IO } from './broadcast.ts';
import { isAIBot, stealPiFromOpponents } from './gameLogic.ts';
import { applyGo, applyStop } from './turnFlow.ts';
import { captureCounts, endGameLog, logPlayCard } from './gameLog.ts';

/**
 * AI 봇이 카드를 내기 전 대기 시간 (ms).
 * 클라 4-phase 시퀀스(약 2초)가 끝난 후 다음 broadcast가 도착하도록 설정.
 * 환경변수 `AI_TURN_DELAY_MS`로 override 가능.
 */
const AI_TURN_DELAY_MS =
  Number(process.env.AI_TURN_DELAY_MS) > 0
    ? Number(process.env.AI_TURN_DELAY_MS)
    : 2200;

/**
 * 현재 턴이 AI 봇이면 setTimeout 후 자동으로 카드를 내고 턴 진행.
 * 다음 턴이 또 AI면 재귀 호출.
 */
export function progressAITurnIfAny(io: IO, room: Room, store: RoomStore): void {
  if (!room.game) return;
  if (room.phase !== 'playing') return;
  // go/stop 결정 대기 중이면 카드 진행 X — autoDecideGoStopForAI가 처리
  if (room.pendingGoStop) return;
  const turnPlayerId = room.game.turnPlayerId;
  if (!isAIBot(turnPlayerId)) return;

  setTimeout(() => {
    // room이 그동안 사라졌거나 phase 변경됐을 수 있음 — 재확인
    const current = store.get(room.id);
    if (!current || current !== room) return;
    if (!room.game) return;
    if (room.phase !== 'playing') return;
    if (room.game.turnPlayerId !== turnPlayerId) return; // 턴 바뀜

    const ai = findPlayer(room, turnPlayerId);
    if (!ai) return;

    // 손패 비었으면 다음 턴
    if (ai.hand.length === 0) {
      const idx = room.players.findIndex((p) => p.id === turnPlayerId);
      const nextIdx = (idx + 1) % room.players.length;
      room.game.turnPlayerId = room.players[nextIdx]!.id;
      const allEmpty = room.players.every((p) => p.hand.length === 0);
      if (allEmpty) room.phase = 'ended';
      broadcastRoomState(io, room);
      progressAITurnIfAny(io, room, store);
      return;
    }

    // AI 카드 선택 — 호스트가 봇별로 설정한 난이도 lookup, 없으면 medium
    const difficulty = room.aiBotDifficulties?.[turnPlayerId] ?? 'medium';
    const cardId = chooseAiCard(ai.hand, room.game.field, ai.collected, difficulty);
    if (!cardId) return;

    try {
      // dev 로그: 액션 직전 state snapshot
      const prevTurnPlayerId = room.game.turnPlayerId;
      const prevCounts = captureCounts(room);

      const isLastTurn = ai.hand.length === 1;
      const result = executeTurn(
        {
          hand: ai.hand,
          collected: ai.collected,
          field: room.game.field,
          deck: room.game.deck,
        },
        cardId,
        {
          allowSpecials: true,
          isLastTurn,
          stuckOwners: room.stuckOwners,
          myActorKey: turnPlayerId,
          bombStealCount: room.rules.bombStealCount,
          // 흔들기 선언된 month — AI는 startGameInRoom에서 자동 적용 (간단화).
          // 사람 player는 게임 도중 카드 클릭 시 모달로 선언 (declareShake event).
          shookMonths: new Set(ai.flags.shookMonths ?? []),
        },
      );

      ai.hand = result.newState.hand;
      ai.collected = result.newState.collected;
      room.game.field = result.newState.field;
      room.game.deck = result.newState.deck;

      if (result.specials.ppeokMonth !== undefined) {
        room.stuckOwners[result.specials.ppeokMonth] = turnPlayerId;
        ai.flags.ppeoksCaused += 1;
      }
      if (result.specials.recoveredMonth !== undefined) {
        delete room.stuckOwners[result.specials.recoveredMonth];
      }
      if (result.specials.bomb) {
        ai.flags.bombs += 1;
        ai.hand = awardBombBonusCards(ai.hand);
      }

      // 클라 EventOverlay 발화용 — 마지막 turn specials broadcast에 포함
      room.lastTurnSpecials = result.specials;
      room.lastTurnActorUserId = turnPlayerId;
      room.turnSeq = (room.turnSeq ?? 0) + 1;
      // history 추가 — 클라 findHandCardObj가 AI hand 마스킹 시 history fallback으로 사용
      room.game.history = [
        ...room.game.history,
        { type: 'play-card', cardId },
      ];
      if (result.specials.stealPi > 0) {
        const stealLog = stealPiFromOpponents(
          room,
          turnPlayerId,
          result.specials.stealPi,
        );
        result.specials.stealPiCards = stealLog;
        room.lastTurnSpecials = result.specials;
      }

      // 게임 종료 체크
      const allEmpty = room.players.every((p) => p.hand.length === 0);
      const ended = ai.flags.ppeoksCaused >= 3 || allEmpty;
      if (ended) {
        room.phase = 'ended';
      }

      // AI도 winScore 도달 검사 (rules-final.md §5).
      const winScore = room.rules.winScore;
      const aiScore = calculateScore(ai.collected, {
        nineYeolAsSsangPi: ai.flags.nineYeolAsSsangPi ?? false,
        allowGukJoon: room.rules.allowGukJoon,
      });
      const reachedWin = !ended && ai.hand.length > 0 && aiScore.total >= winScore;

      if (reachedWin) {
        // AI 액션 후 turn 이동 전 logPlayCard
        logPlayCard(
          room,
          turnPlayerId,
          cardId,
          result.specials,
          prevTurnPlayerId,
          prevCounts.hands,
          prevCounts.pis,
        );
        // AI: 단순 정책 — 손패 4장+ & 2고 이하면 go, 그 외 stop
        const willGo = ai.hand.length >= 4 && ai.goCount < 2;
        if (willGo) {
          applyGo(io, room, store, turnPlayerId);
        } else {
          applyStop(io, room);
          broadcastRoomState(io, room);
        }
      } else {
        // 다음 턴
        const idx = room.players.findIndex((p) => p.id === turnPlayerId);
        const nextIdx = (idx + 1) % room.players.length;
        room.game.turnPlayerId = room.players[nextIdx]!.id;
        // dev 로그
        logPlayCard(
          room,
          turnPlayerId,
          cardId,
          result.specials,
          prevTurnPlayerId,
          prevCounts.hands,
          prevCounts.pis,
        );
        if (ended) endGameLog(room);
        broadcastRoomState(io, room);
        // 다음 턴도 AI면 재귀
        progressAITurnIfAny(io, room, store);
      }
    } catch (e) {
      console.warn(`[room:${room.id}] AI turn error:`, e);
    }
  }, AI_TURN_DELAY_MS);
}
