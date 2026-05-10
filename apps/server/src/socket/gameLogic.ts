/**
 * 서버 게임 로직 helpers — handlers.ts에서 분리.
 *
 * - 광팔이 분배 / 게임 시작 / 피 빼앗기 / 자동 위임 등 핸들러 외부에서 재사용 가능
 * - 모든 함수는 mutation in-place (Room 객체 직접 수정)
 */

import type { AiDifficulty, Card, Player, Room } from '@gostop/shared';
import { dealNewGame, detectChongtong, detectShakesAndBombs } from '@gostop/shared';

/** AI 봇 userId prefix — 일반 사용자와 구분 */
export const AI_BOT_PREFIX = 'ai-bot-';

/** AI 봇 userId 인지 검사 */
export function isAIBot(userId: string): boolean {
  return userId.startsWith(AI_BOT_PREFIX);
}

const AI_BOT_PROFILES: { userId: string; nickname: string; emojiAvatar: string }[] = [
  { userId: 'ai-bot-1', nickname: 'GoStop봇', emojiAvatar: '🤖' },
  { userId: 'ai-bot-2', nickname: 'GoStop봇 2', emojiAvatar: '👽' },
];

/**
 * AI 봇 자동 합류. 호스트가 game:start에서 botDifficulties로 명시한 경우 그대로 적용,
 * 안 했으면 player 1명일 때 medium 난이도 봇 1명 (1:1 맞고).
 *
 * - difficulties.length 만큼 봇 추가, player + bot ≤ 5
 * - room.aiBotDifficulties에 봇별 난이도 저장 (다음 판에도 같은 봇/난이도 유지)
 * - 게임 시작 직전 호출. 다음 판 시작 시 removeAIBots에서 일단 제거 후 재호출 가능
 */
export function fillWithAIBotsIfNeeded(
  room: Room,
  difficulties?: AiDifficulty[],
): void {
  // game:next-round에서는 difficulties가 비어있음 — 직전 판 설정(room.aiBotDifficulties) 재사용
  if (!difficulties || difficulties.length === 0) {
    const prev = room.aiBotDifficulties;
    if (prev) {
      const recovered: AiDifficulty[] = [];
      for (const profile of AI_BOT_PROFILES) {
        const d = prev[profile.userId];
        if (d) recovered.push(d);
      }
      if (recovered.length > 0) {
        difficulties = recovered;
      }
    }
  }

  // 호스트가 명시한 봇 — botDifficulties.length 만큼 추가
  if (difficulties && difficulties.length > 0) {
    const maxBots = Math.min(
      difficulties.length,
      Math.max(0, 5 - room.players.length),
      AI_BOT_PROFILES.length,
    );
    const next: Record<string, AiDifficulty> = { ...(room.aiBotDifficulties ?? {}) };
    for (let i = 0; i < maxBots; i++) {
      const profile = AI_BOT_PROFILES[i]!;
      if (room.players.find((p) => p.id === profile.userId)) continue;
      room.players.push({
        id: profile.userId,
        nickname: profile.nickname,
        emojiAvatar: profile.emojiAvatar,
        hand: [],
        collected: [],
        score: 0,
        goCount: 0,
        flags: { shookMonths: [], bombs: 0, ppeoksCaused: 0, consecutiveAutoTurns: 0 },
        connected: true,
      });
      next[profile.userId] = difficulties[i] ?? 'medium';
    }
    room.aiBotDifficulties = next;
    console.log(
      `[room:${room.id}] AI 봇 ${maxBots}명 추가 (난이도: ${maxBots > 0 ? difficulties.slice(0, maxBots).join(',') : '-'})`,
    );
    return;
  }

  // 1인 자동 AI 모드 — 호스트가 안 정했고 player 1명일 때만 medium 1명 자동
  if (room.players.length >= 2) return;
  const profile = AI_BOT_PROFILES[0]!;
  if (room.players.find((p) => p.id === profile.userId)) return;
  room.players.push({
    id: profile.userId,
    nickname: profile.nickname,
    emojiAvatar: profile.emojiAvatar,
    hand: [],
    collected: [],
    score: 0,
    goCount: 0,
    flags: { shookMonths: [], bombs: 0, ppeoksCaused: 0, consecutiveAutoTurns: 0 },
    connected: true,
  });
  room.aiBotDifficulties = { ...(room.aiBotDifficulties ?? {}), [profile.userId]: 'medium' };
  console.log(`[room:${room.id}] AI 봇 1명 자동 추가 (medium) — player ${room.players.length}명`);
}

/**
 * 모든 AI 봇 player 제거 — 다음 판 시작 시 인원 재검사용. spectators는 유지.
 * aiBotDifficulties는 보존 — 같은 호스트 설정으로 다음 판에 다시 합류 가능.
 */
export function removeAIBots(room: Room): void {
  room.players = room.players.filter((p) => !isAIBot(p.id));
}

/**
 * 광팔이 분배 — 4~5명 player 중 1~2명을 spectator로 이동.
 * 우선순위: (1) 자원자 → (2) 호스트 지정 → (3) 마지막 입장자 자동.
 *
 * 호스트는 자동 선택에서 보호 (게임 시작 권한 유지). 단 호스트가 본인을
 * 자원했거나 다른 사용자가 호스트를 지정한 경우는 그대로 적용.
 */
export function distributeGwangPali(room: Room): void {
  if (room.players.length <= 3) return;
  const gwangPaliCount = room.players.length - 3;
  const playerIdSet = new Set(room.players.map((p) => p.id));
  const volunteers = room.gwangPaliVolunteers.filter((id) => playerIdSet.has(id));
  const assignments = room.gwangPaliAssignments.filter((id) => playerIdSet.has(id));

  const chosen: string[] = [];
  const seen = new Set<string>();
  for (const id of [...volunteers, ...assignments]) {
    if (chosen.length >= gwangPaliCount) break;
    if (!seen.has(id)) {
      chosen.push(id);
      seen.add(id);
    }
  }
  // 자동 선택 — 마지막 입장자부터, 호스트는 skip
  for (let i = room.players.length - 1; i >= 0; i--) {
    if (chosen.length >= gwangPaliCount) break;
    const pId = room.players[i]!.id;
    if (pId === room.hostId) continue; // 호스트 보호
    if (!seen.has(pId)) {
      chosen.push(pId);
      seen.add(pId);
    }
  }

  const chosenSet = new Set(chosen);
  const gwangPaliPlayers = room.players.filter((p) => chosenSet.has(p.id));
  for (const p of gwangPaliPlayers) {
    room.spectators.push({
      id: p.id,
      nickname: p.nickname,
      emojiAvatar: p.emojiAvatar,
      joinedAt: Date.now(),
      connected: p.connected,
      isGwangPali: true,
    });
  }
  room.players = room.players.filter((p) => !chosenSet.has(p.id));
  // 다음 판은 새로 자원/지정 받음
  room.gwangPaliVolunteers = [];
  room.gwangPaliAssignments = [];
  console.log(
    `[room:${room.id}] 광팔이 ${gwangPaliCount}명: ${gwangPaliPlayers.map((p) => p.nickname).join(', ')}`,
  );
}

/**
 * 게임 시작 / 다음 판 시작 공통 로직.
 * - 광팔이 분배 + dealNewGame + 총통 검사 + room.game 초기화
 * - 호출자가 phase/인원 검증 먼저 수행 후 호출
 */
export function startGameInRoom(room: Room): void {
  distributeGwangPali(room);

  const playerIds = room.players.map((p) => p.id);
  const dealt = dealNewGame(playerIds, undefined, {
    jokerCount: room.rules.jokerCount,
    testMode: room.testMode,
  });

  for (const player of room.players) {
    player.hand = dealt.hands[player.id]!;
    player.collected = [];
    player.score = 0;
    player.goCount = 0;
    // 게임 시작 시 흔들기/폭탄 자동 적용 — AI 봇 + 사람 모두.
    // 추후 사람에게는 ShakeBombModal로 선택권 제공 가능 (현재는 90% case 커버).
    const detect = detectShakesAndBombs(player.hand);
    player.flags = {
      shookMonths: [...detect.shakeMonths],
      bombs: detect.bombMonths.length,
      ppeoksCaused: 0,
    };
  }

  // 총통 검사 — 시작 시 손패 같은 월 4장 → 즉시 승리 (선부터 우선)
  let chongtongUserId: string | null = null;
  for (const p of room.players) {
    if (detectChongtong(p.hand) !== null) {
      chongtongUserId = p.id;
      break;
    }
  }

  room.stuckOwners = {};
  room.chongtongUserId = chongtongUserId;
  room.phase = chongtongUserId ? 'ended' : 'playing';
  room.game = {
    field: dealt.field,
    deck: dealt.deck,
    turnPlayerId: playerIds[0]!,
    history: [],
    goCount: 0,
    startedAt: Date.now(),
  };

  if (chongtongUserId) {
    console.log(`[room:${room.id}] 총통 발동: ${chongtongUserId}`);
  }
}

/**
 * 다음 판 — 광팔이 spectator만 다시 player로 복귀.
 * 의도적 spectator(처음부터 관전, isGwangPali=false)는 그대로 spectator 유지.
 * (광팔이 자원/지정은 startGameInRoom 안에서 distributeGwangPali가 새로 분배)
 */
export function reconvertSpectatorsToPlayers(room: Room): void {
  const gwangPaliReturning = room.spectators.filter((s) => s.isGwangPali);
  const stayingSpectators = room.spectators.filter((s) => !s.isGwangPali);

  for (const m of gwangPaliReturning) {
    room.players.push({
      id: m.id,
      nickname: m.nickname,
      emojiAvatar: m.emojiAvatar,
      hand: [],
      collected: [],
      score: 0,
      goCount: 0,
      flags: { shookMonths: [], bombs: 0, ppeoksCaused: 0, consecutiveAutoTurns: 0 },
      connected: m.connected,
    } satisfies Player);
  }
  room.spectators = stayingSpectators;
}

/**
 * 상대로부터 피 N장 가져오기 (뻑/자뻑/따닥/쪽/싹쓸이/폭탄 보너스).
 * 일반 피 우선, 부족하면 쌍피.
 */
export function stealPiFromOpponents(
  room: Room,
  fromUserId: string,
  count: number,
): void {
  const opponents = room.players.filter((p) => p.id !== fromUserId);
  const from = room.players.find((p) => p.id === fromUserId);
  if (!from) return;

  let remaining = count;
  for (const op of opponents) {
    if (remaining <= 0) break;
    const piNormal = op.collected.filter((c) => c.kind === 'pi' && !c.isSsangPi);
    const piSsang = op.collected.filter((c) => c.kind === 'pi' && c.isSsangPi);
    const candidates = [...piNormal, ...piSsang];
    const taken = candidates.slice(0, remaining);
    if (taken.length === 0) continue;

    const takenIds = new Set(taken.map((c: Card) => c.id));
    op.collected = op.collected.filter((c: Card) => !takenIds.has(c.id));
    from.collected = [...from.collected, ...taken];
    remaining -= taken.length;
  }
}
