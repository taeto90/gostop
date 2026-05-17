import type { Card, Room } from '@gostop/shared';
import {
  awardBombBonusCards,
  calculateScore,
  simulateOrNeedsSelection,
  type SimulateTurnResult,
} from '@gostop/shared';
import type { RoomStore } from '../rooms/RoomStore.ts';
import { findPlayer } from '../rooms/playerOps.ts';
import { type IO, broadcastRoomState } from './broadcast.ts';
import { isAIBot, stealPiFromOpponents } from './gameLogic.ts';
import { progressAITurnIfAny } from './aiTurn.ts';
import { appendGameLog, captureCounts, endGameLog, logPlayCard } from './gameLog.ts';

interface PlayCardOpts {
  cardId: string;
  targetAfterHand?: string;
  targetAfterDraw?: string;
  /** 흔들기 O + 바닥 매칭 O에서 사용자가 [1장 내기] 선택 시 true. 폭탄 자동 발동 차단. */
  declineBomb?: boolean;
}

interface PlayCardOutcome {
  ok: true;
  /** 게임 종료 여부 */
  ended: boolean;
}

interface PlayCardSelection {
  ok: false;
  needsSelection: NonNullable<SimulateTurnResult['needsSelection']>;
}

interface PlayCardError {
  ok: false;
  error: string;
}

export type PlayCardResult = PlayCardOutcome | PlayCardSelection | PlayCardError;

/**
 * 한 player의 카드 1장 플레이 처리 (handlers.ts game:action + autoTurn 공통).
 *
 * 흐름:
 *   1. simulateOrNeedsSelection — 매칭 종류 다른 2장이면 needsSelection 응답
 *   2. state mutation (player.hand/collected, field, deck, stuckOwners, ...)
 *   3. specials 처리 (뻑/폭탄/피 빼앗기 등)
 *   4. 다음 turn으로 이동
 *   5. broadcast + AI 봇 자동 진행
 *
 * @param isAuto - true면 사용자가 직접 안 낸 자동 발동 (consecutiveAutoTurns 누적)
 */
export function playCardForPlayer(
  io: IO,
  room: Room,
  store: RoomStore,
  playerId: string,
  opts: PlayCardOpts,
  isAuto = false,
): PlayCardResult {
  if (!room.game) return { ok: false, error: '게임이 시작되지 않음' };
  if (room.phase !== 'playing') return { ok: false, error: '플레이 단계 아님' };
  if (room.game.turnPlayerId !== playerId)
    return { ok: false, error: '본인 턴이 아님' };

  const player = findPlayer(room, playerId);
  if (!player) return { ok: false, error: '플레이어를 찾을 수 없음' };

  const isLastTurn = player.hand.length === 1;
  // 디버그 — 폭탄 발동 안 되는 버그 추적 (rules-final.md §4)
  const _handCard = player.hand.find((c) => c.id === opts.cardId);
  if (_handCard) {
    const sameMonth = player.hand.filter((c) => c.month === _handCard.month);
    const fieldSameMonth = room.game.field.filter((c) => c.month === _handCard.month);
    const shookMonths = player.flags.shookMonths ?? [];
    // eslint-disable-next-line no-console
    console.log('[server playCard]', {
      playerId,
      cardId: opts.cardId,
      handCardMonth: _handCard.month,
      sameMonthInHand: sameMonth.length,
      fieldSameMonthCount: fieldSameMonth.length,
      shookMonths,
      monthShaken: shookMonths.includes(_handCard.month as never),
      declineBomb: opts.declineBomb,
      isBombShouldFire:
        sameMonth.length >= 3 &&
        fieldSameMonth.length === 1 &&
        shookMonths.includes(_handCard.month as never) &&
        !opts.declineBomb,
    });
  }
  // dev 로그: 액션 직전 state snapshot
  const prevTurnPlayerId = room.game.turnPlayerId;
  const prevCounts = captureCounts(room);

  const sim = simulateOrNeedsSelection(
    {
      hand: player.hand,
      collected: player.collected,
      field: room.game.field,
      deck: room.game.deck,
    },
    opts.cardId,
    {
      allowSpecials: true,
      isLastTurn,
      stuckOwners: room.stuckOwners,
      myActorKey: playerId,
      bombStealCount: room.rules.bombStealCount,
      targetAfterHand: opts.targetAfterHand,
      targetAfterDraw: opts.targetAfterDraw,
      // 흔들기 선언된 month 집합 — 폭탄 자동 발동 조건 (rules-final.md §4-2)
      shookMonths: new Set(player.flags.shookMonths ?? []),
      declineBomb: opts.declineBomb,
    },
  );

  if (sim.needsSelection) {
    // 자동 발동 시에도 needsSelection이면 첫 번째 자동 선택 후 재실행
    if (isAuto) {
      const stage = sim.needsSelection.stage;
      const target = sim.needsSelection.candidates[0]!.id;
      return playCardForPlayer(
        io,
        room,
        store,
        playerId,
        {
          cardId: opts.cardId,
          targetAfterHand:
            stage === 'hand' ? target : opts.targetAfterHand,
          targetAfterDraw:
            stage === 'draw' ? target : opts.targetAfterDraw,
        },
        isAuto,
      );
    }
    return { ok: false, needsSelection: sim.needsSelection };
  }

  const result = sim.result!;
  player.hand = result.newState.hand;
  player.collected = result.newState.collected;
  room.game.field = result.newState.field;
  room.game.deck = result.newState.deck;

  if (result.specials.ppeokMonth !== undefined) {
    room.stuckOwners[result.specials.ppeokMonth] = playerId;
    player.flags.ppeoksCaused += 1;
  }
  if (result.specials.recoveredMonth !== undefined) {
    delete room.stuckOwners[result.specials.recoveredMonth];
  }
  if (result.specials.bomb) {
    player.flags.bombs += 1;
    player.hand = awardBombBonusCards(player.hand);
  }

  room.lastTurnSpecials = result.specials;
  room.lastTurnActorUserId = playerId;
  room.turnSeq = (room.turnSeq ?? 0) + 1;

  if (result.specials.stealPi > 0) {
    const stealLog = stealPiFromOpponents(room, playerId, result.specials.stealPi);
    result.specials.stealPiCards = stealLog;
    room.lastTurnSpecials = result.specials;
  }
  room.game.history = [
    ...room.game.history,
    { type: 'play-card', cardId: opts.cardId },
  ];

  // 자동 발동 카운트 누적 / 사용자 직접 클릭 시 reset
  if (isAuto) {
    player.flags.consecutiveAutoTurns = (player.flags.consecutiveAutoTurns ?? 0) + 1;
  } else {
    player.flags.consecutiveAutoTurns = 0;
  }

  const allEmpty = room.players.every((p) => p.hand.length === 0);
  const ended = player.flags.ppeoksCaused >= 3 || allEmpty;
  if (ended) {
    room.phase = 'ended';
  }

  // 본인 턴 종료 후 winScore 도달 검사 (rules-final.md §5).
  // 본인 hand 남아있고 + ended 아니면 → go/stop 선택 대기, turn 이동 X.
  // AI 봇은 progressAITurnIfAny에서 자동 결정.
  const winScore = room.rules.winScore;
  const myScore = calculateScore(player.collected, {
    nineYeolAsSsangPi: player.flags.nineYeolAsSsangPi ?? false,
    allowGukJoon: room.rules.allowGukJoon,
  });
  const reachedWin = !ended && player.hand.length > 0 && myScore.total >= winScore;

  if (reachedWin) {
    room.pendingGoStop = { playerId, score: myScore.total };
    // turn 이동 X — 같은 player가 go 결정 후 다음 턴 진행
  } else {
    // 다음 turn
    const currentIndex = room.players.findIndex((p) => p.id === playerId);
    const nextIndex = (currentIndex + 1) % room.players.length;
    room.game.turnPlayerId = room.players[nextIndex]!.id;
    room.pendingGoStop = null;
  }

  // dev 로그 — 액션 후 state 검증
  logPlayCard(
    room,
    playerId,
    opts.cardId,
    result.specials,
    prevTurnPlayerId,
    prevCounts.hands,
    prevCounts.pis,
  );
  if (ended) endGameLog(room);

  // 새 turn 시작 시점 기록 + timer schedule (다음에 sender가 broadcast 호출)
  scheduleAutoTurnTimer(io, room, store);
  broadcastRoomState(io, room);

  // 다음 턴이 AI면 자동 진행 (pendingGoStop이 있어도 AI라면 안에서 처리)
  if (reachedWin && isAIBot(playerId)) {
    // AI는 단순 정책: 기본 stop. progressAITurnIfAny에서 처리
    autoDecideGoStopForAI(io, room, store, playerId);
  } else {
    progressAITurnIfAny(io, room, store);
  }

  return { ok: true, ended };
}

/**
 * AI 봇이 winScore 도달했을 때의 자동 go/stop 결정.
 * 정책: 1·2고면 무조건 go (점수 증분), 3고+ 또는 hand <= 2장이면 stop.
 */
function autoDecideGoStopForAI(
  io: IO,
  room: Room,
  store: RoomStore,
  playerId: string,
): void {
  setTimeout(() => {
    const current = store.get(room.id);
    if (!current || current !== room) return;
    if (!room.game) return;
    if (!room.pendingGoStop || room.pendingGoStop.playerId !== playerId) return;

    const player = findPlayer(room, playerId);
    if (!player) return;

    const handCount = player.hand.length;
    const goCount = player.goCount;
    // 단순 정책 — 손패 4장 이상 + 2고 이하면 go, 그 외엔 stop
    const willGo = handCount >= 4 && goCount < 2;

    if (willGo) {
      applyGo(io, room, store, playerId);
    } else {
      applyStop(io, room);
      broadcastRoomState(io, room);
    }
  }, 2000);
}

/**
 * declare-go 처리 — pendingGoStop clear, goCount +1, 점수 ×2 누적 (multipliers 계산은 결과 시점),
 * turn 다음으로 이동, broadcast + AI 진행.
 */
export function applyGo(
  io: IO,
  room: Room,
  store: RoomStore,
  playerId: string,
): void {
  if (!room.game) return;
  const player = findPlayer(room, playerId);
  if (!player) return;

  player.goCount += 1;
  room.pendingGoStop = null;

  const currentIndex = room.players.findIndex((p) => p.id === playerId);
  const nextIndex = (currentIndex + 1) % room.players.length;
  room.game.turnPlayerId = room.players[nextIndex]!.id;

  // dev 로그
  appendGameLog(room, {
    ts: Date.now(),
    type: 'declare-go',
    actor: playerId,
    goCount: player.goCount,
    nextTurnPlayerId: room.game?.turnPlayerId,
  });

  scheduleAutoTurnTimer(io, room, store);
  broadcastRoomState(io, room);
  progressAITurnIfAny(io, room, store);
}

/**
 * declare-stop 처리 — phase='ended', pendingGoStop clear.
 * 점수 정산은 client측 ResultView에서 calculateFinalScore로.
 */
export function applyStop(io: IO, room: Room): void {
  room.phase = 'ended';
  room.pendingGoStop = null;
  if (room.turnTimerRef !== undefined) {
    clearTimeout(room.turnTimerRef);
    room.turnTimerRef = undefined;
  }
  // dev 로그
  endGameLog(room);
  // void io — broadcast는 호출자가 처리
  void io;
}

/**
 * 현재 turn player에게 자동 카드 timer 예약.
 * 사람 player + RoomRules.turnTimeLimitSec > 0 일 때만.
 * AI 봇은 progressAITurnIfAny가 처리하므로 여기서 무시.
 *
 * 2번 이상 연속 자동 발동 player는 5초로 단축.
 */
export function scheduleAutoTurnTimer(io: IO, room: Room, store: RoomStore): void {
  // 기존 timer 취소
  if (room.turnTimerRef !== undefined) {
    clearTimeout(room.turnTimerRef);
    room.turnTimerRef = undefined;
  }

  if (!room.game) return;
  if (room.phase !== 'playing') return;

  const turnPlayerId = room.game.turnPlayerId;
  if (isAIBot(turnPlayerId)) {
    // AI는 progressAITurnIfAny가 처리. 사람 카운트다운 없음.
    room.turnStartedAt = undefined;
    room.currentTurnLimitSec = undefined;
    return;
  }

  const baseLimit = room.rules.turnTimeLimitSec;
  if (!baseLimit || baseLimit <= 0) {
    room.turnStartedAt = undefined;
    room.currentTurnLimitSec = undefined;
    return;
  }

  // 모든 상대가 AI면 사람 player에게도 시간 제한 X
  const opponents = room.players.filter((p) => p.id !== turnPlayerId);
  const allOpponentsAI = opponents.length > 0 && opponents.every((p) => isAIBot(p.id));
  if (allOpponentsAI) {
    room.turnStartedAt = undefined;
    room.currentTurnLimitSec = undefined;
    return;
  }

  const player = findPlayer(room, turnPlayerId);
  if (!player) return;

  const autoCount = player.flags.consecutiveAutoTurns ?? 0;
  // 2번 이상 자동 발동된 player는 다음 turn부터 5초로 단축
  const limit = autoCount >= 2 ? Math.min(5, baseLimit) : baseLimit;

  room.turnStartedAt = Date.now();
  room.currentTurnLimitSec = limit;

  room.turnTimerRef = setTimeout(() => {
    autoPlayTurnNow(io, room, store, turnPlayerId);
  }, limit * 1000);
}

/**
 * 시간 초과 시 server측에서 자동 카드 발동.
 * 매칭 가능 카드 중 랜덤, 없으면 일반 카드(폭탄/조커 제외) 랜덤, 그것도 없으면 손패 첫 카드.
 */
function autoPlayTurnNow(
  io: IO,
  room: Room,
  store: RoomStore,
  expectedPlayerId: string,
): void {
  // 그 사이 turn 변경되었으면 무시
  const current = store.get(room.id);
  if (!current || current !== room) return;
  if (!room.game) return;
  if (room.phase !== 'playing') return;
  if (room.game.turnPlayerId !== expectedPlayerId) return;

  const player = findPlayer(room, expectedPlayerId);
  if (!player || player.hand.length === 0) return;

  const cardId = pickAutoCardId(player.hand, room.game.field);
  if (!cardId) return;

  playCardForPlayer(io, room, store, expectedPlayerId, { cardId }, true);
}

/**
 * 자동 카드 선택 — 매칭 가능 → 일반(폭탄/조커 제외) → 전체 순으로 랜덤.
 */
function pickAutoCardId(hand: readonly Card[], field: readonly Card[]): string | null {
  if (hand.length === 0) return null;
  const fieldMonths = new Set(field.map((c) => c.month));
  const matchable = hand.filter(
    (c) => !c.isBomb && !c.isJoker && fieldMonths.has(c.month),
  );
  if (matchable.length > 0) {
    return matchable[Math.floor(Math.random() * matchable.length)]!.id;
  }
  const normal = hand.filter((c) => !c.isBomb && !c.isJoker);
  if (normal.length > 0) {
    return normal[Math.floor(Math.random() * normal.length)]!.id;
  }
  return hand[Math.floor(Math.random() * hand.length)]!.id;
}
