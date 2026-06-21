import type { Card, Player, Room, TurnSpecials } from '@gostop/shared';
import {
  calculateScore,
  simulateOrNeedsSelection,
  type SimulateTurnResult,
} from '@gostop/shared';
import type { RoomStore } from '../rooms/RoomStore.ts';
import { findPlayer } from '../rooms/playerOps.ts';
import { type IO, broadcastRoomState } from './broadcast.ts';
import {
  applyBombAward,
  computeGoThreshold,
  isAIBot,
  stealPiFromOpponents,
  stealPiOneFromEachOpponent,
} from './gameLogic.ts';
import { progressAITurnIfAny, shouldAIGo } from './aiTurn.ts';
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
  // 손에서 낸 카드가 보너스피/조커인지 — 둘 다 턴 유지 (한 번 더 냄, 손패 보충 룰)
  const handPlayedCard = player.hand.find((c) => c.id === opts.cardId);
  const playedHandRefill =
    handPlayedCard?.isBonusPi === true || handPlayedCard?.isJoker === true;
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

  // 뻑/보너스피 stuck 처리 — 사용자 룰 (뻑에 보너스피 끼면 stuck + 회수 보너스)
  const { bonusPisStealable, extraStealFromRecover } = applyPpeokBonusPiRules(
    room,
    player,
    playerId,
    result.specials,
  );

  applyBombAward(player, result.specials);

  room.lastTurnSpecials = result.specials;
  room.lastTurnActorUserId = playerId;
  room.turnSeq = (room.turnSeq ?? 0) + 1;

  // 일반 stealPi (뻑 회수 보너스 포함) + 보너스피 1명당 1장씩
  applyStealPi(room, result.specials, playerId, extraStealFromRecover, bonusPisStealable);
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

  // 종료 판정 전에 점수 계산 — 마지막 손패 winScore 도달 검사에 필요.
  const winScore = room.rules.winScore;
  const myScore = calculateScore(player.collected, {
    nineYeolAsSsangPi: player.flags.nineYeolAsSsangPi ?? false,
    allowGukJoon: room.rules.allowGukJoon,
  });

  // 마지막 손패를 내고 winScore 도달 → 즉시 종료 (go/stop 없이 본인 승리, 후턴 진행 X).
  // 손패가 비면 더 낼 카드가 없어 GO가 불가능 → 그 자리에서 게임 종료 (rules-final.md §5).
  const wonOnLastCard =
    player.hand.length === 0 && myScore.total >= computeGoThreshold(player, winScore);

  const allEmpty = room.players.every((p) => p.hand.length === 0);
  const ended = player.flags.ppeoksCaused >= 3 || allEmpty || wonOnLastCard;
  if (ended) {
    room.phase = 'ended';
  }

  // 본인 턴 종료 후 winScore 도달 검사 (rules-final.md §5).
  // 본인 hand 남아있고 + ended 아니면 → go/stop 선택 대기, turn 이동 X.
  // AI 봇은 progressAITurnIfAny에서 자동 결정.
  //
  // 고 조건:
  //   첫 고 — winScore 이상 도달
  //   2고+ — 직전 고 점수보다 1점 이상 올라야 (lastGoScore 비교)
  const reachedWin =
    !ended && player.hand.length > 0 && myScore.total >= computeGoThreshold(player, winScore);

  if (reachedWin) {
    room.pendingGoStop = { playerId, score: myScore.total };
    // turn 이동 X — 같은 player가 go 결정 후 다음 턴 진행
  } else if (playedHandRefill && !ended) {
    // 보너스피/조커 — 손패 보충 후 같은 player가 한 번 더 (턴 이동 X)
    room.pendingGoStop = null;
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

    const difficulty = room.aiBotDifficulties?.[playerId] ?? 'medium';
    const willGo = shouldAIGo(player, room, difficulty as 'easy' | 'medium' | 'hard');

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
  // 이번 고 시점 점수 기록 — 다음 고는 이보다 1점 이상 올라야 가능 (rules-final.md §5)
  player.flags.lastGoScore = room.pendingGoStop?.score ?? player.flags.lastGoScore;
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
export function applyStop(io: IO, room: Room, stoppedByUserId?: string): void {
  room.stoppedByUserId = stoppedByUserId ?? room.pendingGoStop?.playerId ?? null;
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

/**
 * 뻑/보너스피 상호작용 처리 — 사용자 룰.
 *
 * - 뻑(ppeokMonth) 발생 + 이번 턴 보너스피 끼임: 그 보너스피를 player.collected에서
 *   제거하고 room.stuckBonusPis[ppeokMonth]에 stuck. 보너스피 stealPi 효과도 취소.
 * - 뻑 회수(recoveredMonth) + 그 month에 stuck된 보너스피: 회수자가 함께 가져감 +
 *   추가 stealPi = 보너스피 수 + 1.
 * - stuckOwners 정상 갱신/제거도 같이 처리.
 *
 * @returns 보너스피 stealPi 적용 대상 수 + 뻑 회수 추가 stealPi
 */
function applyPpeokBonusPiRules(
  room: Room,
  player: Player,
  playerId: string,
  specials: TurnSpecials,
): { bonusPisStealable: number; extraStealFromRecover: number } {
  const ppeokMonth = specials.ppeokMonth;
  const turnBonusPis = specials.bonusPiCards ?? [];
  let bonusPisStealable = specials.bonusPiCollected;

  if (ppeokMonth !== undefined && turnBonusPis.length > 0) {
    const stuckIds = new Set(turnBonusPis.map((c) => c.id));
    player.collected = player.collected.filter((c) => !stuckIds.has(c.id));
    room.stuckBonusPis[ppeokMonth] = [
      ...(room.stuckBonusPis[ppeokMonth] ?? []),
      ...turnBonusPis,
    ];
    bonusPisStealable = 0; // 점수판 X → stealPi 효과도 취소
  }

  if (ppeokMonth !== undefined) {
    room.stuckOwners[ppeokMonth] = playerId;
    player.flags.ppeoksCaused += 1;
  }

  const recoveredMonth = specials.recoveredMonth;
  let extraStealFromRecover = 0;
  if (recoveredMonth !== undefined) {
    const recoveredBonus = room.stuckBonusPis[recoveredMonth] ?? [];
    if (recoveredBonus.length > 0) {
      player.collected = [...player.collected, ...recoveredBonus];
      extraStealFromRecover = recoveredBonus.length + 1;
      delete room.stuckBonusPis[recoveredMonth];
    }
    delete room.stuckOwners[recoveredMonth];
  }

  return { bonusPisStealable, extraStealFromRecover };
}

/**
 * stealPi 적용 — 일반 stealPi (한 명부터 차례로) + 보너스피 (각 상대로부터 1장씩).
 * 결과를 specials.stealPiCards에 누적.
 */
function applyStealPi(
  room: Room,
  specials: TurnSpecials,
  playerId: string,
  extraStealFromRecover: number,
  bonusPisStealable: number,
): void {
  const totalStealPi = specials.stealPi + extraStealFromRecover;
  if (totalStealPi > 0) {
    specials.stealPiCards = stealPiFromOpponents(room, playerId, totalStealPi);
    room.lastTurnSpecials = specials;
  }
  if (bonusPisStealable > 0) {
    const bonusLog = stealPiOneFromEachOpponent(room, playerId, bonusPisStealable);
    specials.stealPiCards = [...(specials.stealPiCards ?? []), ...bonusLog];
    room.lastTurnSpecials = specials;
  }
}
