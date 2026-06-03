/**
 * 서버측 AI 봇 턴 자동 진행 (B.19).
 *
 * - room.game.turnPlayerId가 AI 봇이면 setTimeout 후 chooseAiCard + executeTurn 호출
 * - 결과 broadcast + 다음 턴이 또 AI면 재귀
 * - room이 살아있고 phase === 'playing'일 때만 동작
 */

import type { Player, Room } from '@gostop/shared';
import {
  calculateScore,
  chooseAiCard,
  executeTurn,
  findMatches,
} from '@gostop/shared';

import type { RoomStore } from '../rooms/RoomStore.ts';
import { findPlayer } from '../rooms/playerOps.ts';
import { broadcastRoomState, type IO } from './broadcast.ts';
import {
  applyBombAward,
  computeGoThreshold,
  isAIBot,
  stealPiFromOpponents,
} from './gameLogic.ts';
import { applyGo, applyStop } from './turnFlow.ts';
import { captureCounts, endGameLog, logPlayCard } from './gameLog.ts';

/**
 * AI 봇이 카드를 내기 전 대기 시간 (ms).
 * 클라 4-phase 시퀀스(약 2초)가 끝난 후 다음 broadcast가 도착하도록 설정.
 * 환경변수 `AI_TURN_DELAY_MS`로 override 가능.
 */
/**
 * AI go/stop 결정 — 난이도별 전략.
 * - easy: 항상 STOP
 * - medium: 손패 4+ & goCount < 2 & 매칭 가능 카드 있으면 GO
 * - hard: 상대 점수 고려 + 적극적 GO (박 노림)
 */
export function shouldAIGo(
  player: Player,
  room: Room,
  difficulty: 'easy' | 'medium' | 'hard',
): boolean {
  const hand = player.hand;
  const goCount = player.goCount;

  if (difficulty === 'easy') return false;

  if (hand.length < 2) return false;

  // 이미 압도적 점수(winScore 2배 이상)면 난이도 무관 STOP.
  // 고박 리스크 회피 + 더 딸 카드 없을 때 무의미한 GO로 게임이 질질 끌리는 것 방지.
  const myScore = calculateScore(player.collected, {
    nineYeolAsSsangPi: player.flags.nineYeolAsSsangPi ?? false,
    allowGukJoon: room.rules.allowGukJoon,
  }).total;
  if (myScore >= room.rules.winScore * 2) return false;

  const field = room.game?.field ?? [];
  const matchableCount = hand.filter(
    (c) => !c.isBomb && !c.isJoker && !c.isBonusPi && findMatches(field, c).length > 0,
  ).length;

  if (difficulty === 'medium') {
    return hand.length >= 4 && goCount < 2 && matchableCount >= 2;
  }

  // hard — 상대 최고 점수 확인, 박 가능성 있으면 적극적 GO
  const opponents = room.players.filter((p) => p.id !== player.id);
  const maxOpponentScore = Math.max(
    ...opponents.map((p) =>
      calculateScore(p.collected, {
        nineYeolAsSsangPi: p.flags.nineYeolAsSsangPi ?? false,
        allowGukJoon: room.rules.allowGukJoon,
      }).total,
    ),
    0,
  );

  if (goCount >= 3) return false;
  if (hand.length >= 3 && matchableCount >= 1 && myScore > maxOpponentScore) return true;
  if (hand.length >= 4 && goCount < 2) return true;
  return false;
}

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
      // 손에서 낸 카드가 보너스피/조커면 턴 유지 (한 번 더 — 손패 보충 룰)
      const aiPlayedCard = ai.hand.find((c) => c.id === cardId);
      const playedHandRefill =
        aiPlayedCard?.isBonusPi === true || aiPlayedCard?.isJoker === true;
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
      applyBombAward(ai, result.specials);

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
      // 2고+는 직전 고 점수보다 1점 이상 올라야 다시 고 가능 (turnFlow와 동일 goThreshold).
      const winScore = room.rules.winScore;
      const aiScore = calculateScore(ai.collected, {
        nineYeolAsSsangPi: ai.flags.nineYeolAsSsangPi ?? false,
        allowGukJoon: room.rules.allowGukJoon,
      });
      const reachedWin =
        !ended && ai.hand.length > 0 && aiScore.total >= computeGoThreshold(ai, winScore);

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
        const aiDifficulty = room.aiBotDifficulties?.[turnPlayerId] ?? 'medium';
        const willGo = shouldAIGo(ai, room, aiDifficulty as 'easy' | 'medium' | 'hard');
        if (willGo) {
          // pendingGoStop 설정 → applyGo가 lastGoScore를 이번 점수로 기록 (다음 고 기준).
          // (미설정 시 applyGo가 lastGoScore를 못 올려 AI가 같은 점수로 계속 고함)
          room.pendingGoStop = { playerId: turnPlayerId, score: aiScore.total };
          applyGo(io, room, store, turnPlayerId);
        } else {
          // 즉시 승리 경로 — pendingGoStop 미설정이므로 stoppedByUserId 명시 전달.
          // (미전달 시 null → 클라가 상대 STOP 이펙트를 건너뛰고 바로 게임종료로 감)
          applyStop(io, room, turnPlayerId);
          broadcastRoomState(io, room);
        }
      } else {
        // 보너스피/조커면 턴 유지 (한 번 더), 아니면 다음 턴
        if (!(playedHandRefill && !ended)) {
          const idx = room.players.findIndex((p) => p.id === turnPlayerId);
          const nextIdx = (idx + 1) % room.players.length;
          room.game.turnPlayerId = room.players[nextIdx]!.id;
        }
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
        // 같은 AI가 보너스피로 턴 유지 → 재귀로 다시 진행. 다음 턴도 AI면 재귀.
        progressAITurnIfAny(io, room, store);
      }
    } catch (e) {
      console.warn(`[room:${room.id}] AI turn error:`, e);
    }
  }, AI_TURN_DELAY_MS);
}
