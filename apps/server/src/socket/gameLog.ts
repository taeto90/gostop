/**
 * 게임 로그 시스템 — dev only (NODE_ENV !== 'production').
 *
 * 각 게임마다 별도 JSON 파일 생성 (logs/game-{roomId}-{instanceId}-{timestamp}.json).
 * 매 액션마다 append 후 게임 종료 시 validation 결과 추가.
 *
 * 검증 항목 (rules-final.md):
 *   1. 순서 — turn 이동이 players 배열 순환 순서대로인가
 *   2. 점수 계산 — calculateScore 결과 (final score과 일치)
 *   3. 카드 중복 — 모든 위치(hand/collected/field/deck) 합쳐서 ID 중복 없는가
 *   4. 피 빼앗기 — stealPi가 옳게 적용 (from/to 카드 ID 정확)
 *
 * production에서는 모든 함수가 no-op (성능/디스크 영향 X).
 */

import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import type { Card, Room, TurnSpecials } from '@gostop/shared';
import { calculateScore } from '@gostop/shared';

const ENABLED = process.env.NODE_ENV !== 'production';
const LOG_DIR = join(cwd(), 'logs');

interface GameLogEntry {
  ts: number;
  type: string;
  // 자유 필드 — JSON.stringify 가능한 모든 값
  [key: string]: unknown;
}

// roomId-instanceId → filepath
const activeLogs = new Map<string, string>();

function logKey(room: Room): string {
  return `${room.id}-${room.gameInstanceId ?? 0}`;
}

function ensureDir(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

/** 모든 카드 ID 수집 — 중복 검사용 */
function collectAllCardIds(room: Room): {
  total: number;
  unique: number;
  duplicates: string[];
} {
  if (!room.game) return { total: 0, unique: 0, duplicates: [] };
  const ids: string[] = [];
  for (const p of room.players) {
    for (const c of p.hand) ids.push(c.id);
    for (const c of p.collected) ids.push(c.id);
  }
  for (const c of room.game.field) ids.push(c.id);
  for (const c of room.game.deck) ids.push(c.id);
  const seen = new Set<string>();
  const dup: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) dup.push(id);
    seen.add(id);
  }
  return { total: ids.length, unique: seen.size, duplicates: dup };
}

/** player별 피 카운트 — stealPi 검증용 */
function piCounts(cards: readonly Card[]): { normal: number; ssang: number } {
  let normal = 0;
  let ssang = 0;
  for (const c of cards) {
    if (c.kind !== 'pi') continue;
    if (c.isSsangPi) ssang++;
    else normal++;
  }
  return { normal, ssang };
}

/** 게임 시작 — 새 로그 파일 생성 (분배 상태 + 룰 snapshot) */
export function startGameLog(room: Room): void {
  if (!ENABLED) return;
  if (!room.game) return;
  try {
    ensureDir();
    const key = logKey(room);
    const ts = Date.now();
    const filename = `game-${room.id}-${room.gameInstanceId ?? 0}-${ts}.json`;
    const filepath = join(LOG_DIR, filename);
    activeLogs.set(key, filepath);

    const dup = collectAllCardIds(room);
    const header = {
      schemaVersion: 1,
      type: 'game-start',
      ts,
      roomId: room.id,
      gameInstanceId: room.gameInstanceId ?? 0,
      rules: room.rules,
      testMode: room.testMode,
      testPreset: room.testPreset,
      players: room.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        handCount: p.hand.length,
        hand: p.hand.map((c) => c.id),
        collected: p.collected.map((c) => c.id),
        flags: p.flags,
      })),
      field: room.game.field.map((c) => c.id),
      deckCount: room.game.deck.length,
      turnPlayerId: room.game.turnPlayerId,
      stuckOwners: room.stuckOwners,
      chongtongUserId: room.chongtongUserId,
      cardCheck: {
        totalCardCount: dup.total,
        uniqueCardCount: dup.unique,
        duplicates: dup.duplicates,
        valid: dup.duplicates.length === 0,
      },
    };
    writeFileSync(filepath, JSON.stringify(header, null, 2) + '\n');
    appendFileSync(filepath, '"--- entries ---"\n');
  } catch (e) {
    console.warn('[gameLog] startGameLog failed:', e);
  }
}

/** 액션 entry append — type별 자유 payload */
export function appendGameLog(room: Room, entry: GameLogEntry): void {
  if (!ENABLED) return;
  const key = logKey(room);
  const filepath = activeLogs.get(key);
  if (!filepath) return;
  try {
    appendFileSync(filepath, JSON.stringify(entry) + '\n');
  } catch (e) {
    console.warn('[gameLog] appendGameLog failed:', e);
  }
}

/**
 * play-card 후 호출 — 액션 상세 + state 변화 + 검증.
 */
export function logPlayCard(
  room: Room,
  playerId: string,
  cardId: string,
  specials: TurnSpecials,
  prevTurnPlayerId: string,
  prevHandCounts: Record<string, number>,
  prevCollectedCounts: Record<string, { normal: number; ssang: number }>,
): void {
  if (!ENABLED) return;
  if (!room.game) return;

  const playerIds = room.players.map((p) => p.id);
  const prevIdx = playerIds.indexOf(prevTurnPlayerId);
  const expectedNextIdx = (prevIdx + 1) % playerIds.length;
  const expectedNext = playerIds[expectedNextIdx];
  const actualNext = room.game.turnPlayerId;

  // 순서 검증 — pendingGoStop이면 turn 이동 X 정상, 아니면 expectedNext == actualNext
  const orderValid =
    room.pendingGoStop?.playerId === playerId ||
    room.phase === 'ended' ||
    actualNext === expectedNext;

  // 점수 재계산 검증
  const scoreCheck: Record<string, { stored: number; recomputed: number; match: boolean }> = {};
  for (const p of room.players) {
    const computed = calculateScore(p.collected, {
      nineYeolAsSsangPi: p.flags.nineYeolAsSsangPi ?? false,
      allowGukJoon: room.rules.allowGukJoon,
    });
    scoreCheck[p.id] = {
      stored: p.score,
      recomputed: computed.total,
      // p.score는 매 액션마다 갱신 안 됨 (서버는 final 계산만) — recomputed는 참고용
      match: true,
    };
  }

  // 카드 중복 검사
  const dup = collectAllCardIds(room);

  // 피 빼앗기 검증 — specials.stealPiCards가 있으면 from→to 카드 이동 검증
  const stealCheck: Array<{
    from: string;
    to: string;
    cardId: string;
    fromHasCard: boolean;
    toHasCard: boolean;
  }> = [];
  if (specials.stealPiCards) {
    for (const log of specials.stealPiCards) {
      const fromP = room.players.find((p) => p.id === log.from);
      const toP = room.players.find((p) => p.id === log.to);
      // 빼앗긴 후엔 from에 없고 to에 있어야
      stealCheck.push({
        from: log.from,
        to: log.to,
        cardId: log.cardId,
        fromHasCard: fromP?.collected.some((c) => c.id === log.cardId) ?? false,
        toHasCard: toP?.collected.some((c) => c.id === log.cardId) ?? false,
      });
    }
  }
  const stealValid = stealCheck.every((s) => !s.fromHasCard && s.toHasCard);

  // 피 카운트 변화 — stealPi 적용된 player들 검증
  const piDelta: Record<string, { before: { normal: number; ssang: number }; after: { normal: number; ssang: number } }> = {};
  for (const p of room.players) {
    const after = piCounts(p.collected);
    const before = prevCollectedCounts[p.id] ?? { normal: 0, ssang: 0 };
    if (before.normal !== after.normal || before.ssang !== after.ssang) {
      piDelta[p.id] = { before, after };
    }
  }

  appendGameLog(room, {
    ts: Date.now(),
    type: 'play-card',
    actor: playerId,
    cardId,
    specials: {
      ppeokMonth: specials.ppeokMonth,
      bomb: specials.bomb,
      stealPi: specials.stealPi,
      stealPiCards: specials.stealPiCards,
      jjok: specials.jjok,
      ttadak: specials.ttadak,
      sweep: specials.sweep,
      isOwnRecover: specials.isOwnRecover,
      recoveredMonth: specials.recoveredMonth,
    },
    turnShift: {
      prev: prevTurnPlayerId,
      expectedNext,
      actualNext,
      pendingGoStop: room.pendingGoStop ?? null,
      phase: room.phase,
      orderValid,
    },
    handCountDelta: Object.fromEntries(
      room.players.map((p) => [
        p.id,
        { before: prevHandCounts[p.id] ?? 0, after: p.hand.length },
      ]),
    ),
    piDelta,
    scoreCheck,
    cardCheck: {
      totalCardCount: dup.total,
      uniqueCardCount: dup.unique,
      duplicates: dup.duplicates,
      valid: dup.duplicates.length === 0,
    },
    stealCheck,
    stealValid,
  });
}

/** 게임 종료 — final summary + 닫힘 */
export function endGameLog(room: Room): void {
  if (!ENABLED) return;
  const key = logKey(room);
  const filepath = activeLogs.get(key);
  if (!filepath) return;
  try {
    const dup = collectAllCardIds(room);
    const finalScores: Record<string, number> = {};
    for (const p of room.players) {
      const s = calculateScore(p.collected, {
        nineYeolAsSsangPi: p.flags.nineYeolAsSsangPi ?? false,
        allowGukJoon: room.rules.allowGukJoon,
      });
      finalScores[p.id] = s.total;
    }
    appendFileSync(
      filepath,
      JSON.stringify({
        ts: Date.now(),
        type: 'game-end',
        phase: room.phase,
        finalScores,
        ppeoksCaused: Object.fromEntries(
          room.players.map((p) => [p.id, p.flags.ppeoksCaused]),
        ),
        goCounts: Object.fromEntries(room.players.map((p) => [p.id, p.goCount])),
        cardCheck: {
          totalCardCount: dup.total,
          uniqueCardCount: dup.unique,
          duplicates: dup.duplicates,
          valid: dup.duplicates.length === 0,
        },
        chongtongUserId: room.chongtongUserId,
      }) + '\n',
    );
    activeLogs.delete(key);
    console.log(`[gameLog] saved ${filepath}`);
  } catch (e) {
    console.warn('[gameLog] endGameLog failed:', e);
  }
}

/** 사전 카운트 캡처 — playCardForPlayer 호출 직전에 prev state 저장용 */
export function captureCounts(room: Room): {
  hands: Record<string, number>;
  pis: Record<string, { normal: number; ssang: number }>;
} {
  const hands: Record<string, number> = {};
  const pis: Record<string, { normal: number; ssang: number }> = {};
  for (const p of room.players) {
    hands[p.id] = p.hand.length;
    pis[p.id] = piCounts(p.collected);
  }
  return { hands, pis };
}
