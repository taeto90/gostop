import type { Card } from '../types/card.ts';
import { createJokerCard, createShuffledDeck, DECK, getCardById } from '../cards/deck.ts';
import { playCard } from './matching.ts';
import type { PresetSetup } from './presets.ts';

/**
 * 카드 분배 결과.
 */
export interface DealResult {
  /** playerId → 손패 */
  hands: Record<string, Card[]>;
  /** 바닥 카드 */
  field: Card[];
  /** 남은 더미 */
  deck: Card[];
  /** 시작부터 player에게 부여된 collected (preset 모드만) */
  collected?: Record<string, Card[]>;
}

export interface DealOptions {
  /** 조커 카드 추가 장수 (default 0). 셔플 후 분배 — 더미가 N장 늘어남. */
  jokerCount?: 0 | 1 | 2 | 3;
  /**
   * 테스트 모드 — preset이 없으면 손패 1장 + 바닥 1장만 분배 (나머지는 더미).
   * preset 명시 시 명시된 카드만 고정하고 나머지는 정상 분배.
   */
  testMode?: boolean;
  /** 테스트 모드 preset 카드 셋업 (testMode=true일 때만 적용) */
  preset?: PresetSetup;
}

/** 분배 시 같은 월 4장이 모두 바닥에 깔린 경우 reshuffle 최대 시도 횟수 */
const MAX_RESHUFFLE_ATTEMPTS = 10;

/**
 * 새 게임 시작 — 카드 셔플 후 손패/바닥/더미 분배.
 *
 * 정통 룰 (rules-final.md §0-4): 같은 월 4장이 모두 바닥에 깔리면 재분배.
 * 이 경우 해당 월 카드를 어떤 player도 소유하지 못해 게임 진행이 무의미.
 */
export function dealNewGame(
  playerIds: readonly string[],
  rng?: () => number,
  options: DealOptions = {},
): DealResult {
  if (playerIds.length < 2 || playerIds.length > 3) {
    throw new Error(`고스톱은 2~3인만 가능 (현재 ${playerIds.length}명)`);
  }

  // testMode + preset → preset 카드 고정 분배 (정상 인원수 손패/바닥 유지)
  if (options.testMode && options.preset) {
    return dealWithPreset(playerIds, options.preset, rng, options.jokerCount ?? 0);
  }
  // testMode만 — 손패 1장 + 바닥 1장 (기존 흐름 검증용)
  if (options.testMode) {
    return dealOnce(playerIds, rng, options);
  }

  for (let attempt = 0; attempt < MAX_RESHUFFLE_ATTEMPTS; attempt++) {
    const result = dealOnce(playerIds, rng, options);
    if (!hasFieldAllSameMonth(result.field)) {
      return result;
    }
  }
  // 10회 시도해도 reshuffle 조건이 계속 발생 = 사실상 불가능. 최후 결과 반환.
  return dealOnce(playerIds, rng, options);
}

/** 바닥 카드 중 같은 월 4장이 모두 깔렸는지 검사 (조커 제외 — 매칭 X) */
function hasFieldAllSameMonth(field: readonly Card[]): boolean {
  const counts = new Map<number, number>();
  for (const c of field) {
    if (c.isJoker) continue;
    counts.set(c.month, (counts.get(c.month) ?? 0) + 1);
  }
  for (const count of counts.values()) {
    if (count >= 4) return true;
  }
  return false;
}

/**
 * Preset 분배 — 명시된 카드 ID는 그 위치(손패/바닥/딴패/더미 top)에 고정,
 * 나머지는 DECK에서 사용한 카드 빼고 셔플 후 채움.
 *
 * @internal — `dealNewGame({ testMode: true, preset })` 통해서만 호출됨
 */
export function dealWithPreset(
  playerIds: readonly string[],
  setup: PresetSetup,
  rng?: () => number,
  jokerCount = 0,
): DealResult {
  const HAND_SIZE = playerIds.length === 2 ? 10 : 7;
  const FIELD_SIZE = playerIds.length === 2 ? 8 : 6;

  const usedIds = new Set<string>();
  const collect = (ids?: readonly string[]) => ids?.forEach((id) => usedIds.add(id));
  collect(setup.myHand);
  collect(setup.myCollected);
  collect(setup.botHand);
  collect(setup.botCollected);
  collect(setup.field);
  collect(setup.drawTop);

  // 명시되지 않은 카드들로 채움 (조커는 별도 추가)
  const restCards = DECK.filter((c) => !usedIds.has(c.id));
  const r = rng ?? Math.random;
  const shuffled = [...restCards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }

  const resolveIds = (ids: readonly string[] | undefined): Card[] =>
    (ids ?? []).map((id) => {
      const c = getCardById(id);
      if (!c) throw new Error(`Preset 카드 ID 없음: ${id}`);
      return c;
    });

  const hands: Record<string, Card[]> = {};
  const collected: Record<string, Card[]> = {};
  let cursor = 0;

  // 본인 (players[0]) 손패 + collected
  const me = playerIds[0]!;
  hands[me] = [...resolveIds(setup.myHand)];
  collected[me] = [...resolveIds(setup.myCollected)];
  while (hands[me]!.length < HAND_SIZE) hands[me]!.push(shuffled[cursor++]!);

  // 봇 (players[1]) — 명시된 setup.botHand/botCollected 적용
  if (playerIds.length >= 2) {
    const bot = playerIds[1]!;
    hands[bot] = [...resolveIds(setup.botHand)];
    collected[bot] = [...resolveIds(setup.botCollected)];
    while (hands[bot]!.length < HAND_SIZE) hands[bot]!.push(shuffled[cursor++]!);
  }
  // 3인 — 추가 player는 그냥 셔플로 채움
  for (let i = 2; i < playerIds.length; i++) {
    const pid = playerIds[i]!;
    hands[pid] = [];
    collected[pid] = [];
    while (hands[pid]!.length < HAND_SIZE) hands[pid]!.push(shuffled[cursor++]!);
  }

  // 바닥
  const field = [...resolveIds(setup.field)];
  while (field.length < FIELD_SIZE) field.push(shuffled[cursor++]!);

  // 더미: drawTop (FIFO) + 나머지 셔플 + 조커 (있으면 셔플 안에 섞음)
  const drawTop = resolveIds(setup.drawTop);
  let restDeck = shuffled.slice(cursor);
  if (jokerCount > 0) {
    const jokers = Array.from({ length: jokerCount }, () => createJokerCard());
    restDeck = [...restDeck, ...jokers];
    for (let i = restDeck.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const tmp = restDeck[i]!;
      restDeck[i] = restDeck[j]!;
      restDeck[j] = tmp;
    }
  }
  const deck = [...drawTop, ...restDeck];

  return { hands, field, deck, collected };
}

/** 1회 분배 (reshuffle 검사 없이) */
function dealOnce(
  playerIds: readonly string[],
  rng: (() => number) | undefined,
  options: DealOptions,
): DealResult {
  let shuffled = createShuffledDeck(rng);
  // 조커 카드 옵션 — DECK 48장 + 조커 N장을 합쳐 다시 셔플
  const jokerCount = options.jokerCount ?? 0;
  if (jokerCount > 0) {
    const jokers = Array.from({ length: jokerCount }, () => createJokerCard());
    shuffled = [...shuffled, ...jokers];
    // Fisher-Yates로 다시 한번 셔플
    const r = rng ?? Math.random;
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const tmp = shuffled[i]!;
      shuffled[i] = shuffled[j]!;
      shuffled[j] = tmp;
    }
  }
  // 인원별 분배 (rules-final.md):
  //   2인 (맞고): 손패 10장, 바닥 8장, 더미 20장
  //   3인:        손패 7장,  바닥 6장, 더미 21장
  // 테스트 모드: 손패 1장 + 바닥 1장 (흐름 검증용, 추후 제거)
  const HAND_SIZE = options.testMode ? 1 : playerIds.length === 2 ? 10 : 7;
  const FIELD_SIZE = options.testMode ? 1 : playerIds.length === 2 ? 8 : 6;

  const hands: Record<string, Card[]> = {};
  for (const id of playerIds) hands[id] = [];

  let cursor = 0;
  for (let round = 0; round < HAND_SIZE; round++) {
    for (const id of playerIds) {
      hands[id]!.push(shuffled[cursor]!);
      cursor++;
    }
  }

  const field = shuffled.slice(cursor, cursor + FIELD_SIZE);
  cursor += FIELD_SIZE;

  const deck = shuffled.slice(cursor);
  return { hands, field, deck };
}

/**
 * 한 턴의 입력/출력 상태.
 */
export interface TurnState {
  hand: Card[];
  collected: Card[];
  field: Card[];
  deck: Card[];
}

export interface TurnOptions {
  targetAfterHand?: string;
  targetAfterDraw?: string;
  /** Phase 4 뻑/특수 매칭 룰 적용 */
  allowSpecials?: boolean;
  /** 마지막 턴 — 싹쓸이 시 피 빼앗기 X (rules-final.md 관례) */
  isLastTurn?: boolean;
  /**
   * stuck month → owner actor 매핑. 회수 발생 시 owner를 비교해 자뻑/일반회수 자동 판정.
   * `myActorKey`와 함께 전달.
   */
  stuckOwners?: Readonly<Record<number, string>>;
  /** 현재 턴 actor — stuckOwners 비교용 */
  myActorKey?: string;
  /**
   * 폭탄 발동 시 상대로부터 빼앗는 피 장수 (default 1, 옵션 1 또는 2).
   * 룰 모달에서 호스트가 결정.
   */
  bombStealCount?: 1 | 2;
  /**
   * 해당 player가 흔들기 선언한 month 집합 (rules-final.md §4-2).
   * 폭탄 자동 발동 조건 — 흔들기 미선언 month는 폭탄 X (정통 룰: 흔들기 O면만 폭탄 가능).
   * server playCardForPlayer가 player.flags.shookMonths로부터 전달.
   */
  shookMonths?: ReadonlySet<number>;
  /**
   * 흔들기 O + 바닥 매칭 O 시 사용자가 [폭탄/1장 내기] 모달에서 1장 내기 선택한 경우.
   * true면 isBomb 검사 우회 — 일반 매칭으로 처리 (1장만 내고 남은 2장은 손패 유지).
   */
  declineBomb?: boolean;
}

export interface TurnEvent {
  step: 'play-hand' | 'draw';
  card: Card;
  result: 'matched' | 'placed' | 'ppeok' | 'recovered';
  collectedCards: Card[];
  fieldAfter: Card[];
}

/**
 * Phase 4 특수 상황 감지 결과.
 */
export interface TurnSpecials {
  /** 따닥 — 손패와 더미가 같은 월에서 모두 매칭 */
  ttadak: boolean;
  /** 쪽 — 손패는 placed, 더미가 같은 월 매칭 */
  jjok: boolean;
  /** 싹쓸이 — 매칭 후 바닥이 비어버림 */
  sweep: boolean;
  /** 폭탄 — 손패 같은 월 3장 + 바닥 1장 → 한 번에 4장 가져감 */
  bomb?: boolean;
  /** 뻑 발생 — stuck month */
  ppeokMonth?: number;
  /** 뻑 회수 / 자뻑 — month */
  recoveredMonth?: number;
  /** 회수가 자뻑인지 여부 (TurnOptions.isOwnPpeok 그대로 반영) */
  isOwnRecover?: boolean;
  /** 상대로부터 빼앗을 피 카드 수 (특수 룰 누적) */
  stealPi: number;
  /**
   * 빼앗은 피 카드 상세 — server stealPiFromOpponents가 set.
   * client Phase 5에서 상대 collected → 본인 collected 비행 시각효과용.
   * shared executeTurn 단계에서는 빈 배열, server playCardForPlayer/aiTurn이 채움.
   */
  stealPiCards?: { from: string; to: string; cardId: string }[];
}

export interface TurnResult {
  newState: TurnState;
  events: TurnEvent[];
  specials: TurnSpecials;
}

/**
 * 한 턴 실행 — 손패에서 1장 내고, 더미에서 1장 뒤집어 매칭 적용.
 *
 * Phase 4 (allowSpecials=true): 따닥/쪽/뻑/자뻑/싹쓸이 감지.
 */
export function executeTurn(
  state: TurnState,
  handCardId: string,
  options: TurnOptions = {},
): TurnResult {
  const handCardIndex = state.hand.findIndex((c) => c.id === handCardId);
  if (handCardIndex < 0) {
    throw new Error(`Card "${handCardId}" not in hand`);
  }
  const handCard = state.hand[handCardIndex]!;
  const newHand = [...state.hand.slice(0, handCardIndex), ...state.hand.slice(handCardIndex + 1)];

  const allowPpeok = options.allowSpecials ?? false;
  const specials: TurnSpecials = { ttadak: false, jjok: false, sweep: false, stealPi: 0 };

  // 조커 카드 처리 — 옵션 룰. 매칭 X, 손패 → collected 이동 + 더미 1장 뒤집기.
  // (rule3·rule4: 조커는 보통 쌍피로 활용, isSsangPi=true로 collected에 들어감)
  if (handCard.isJoker) {
    const events: TurnEvent[] = [
      {
        step: 'play-hand',
        card: handCard,
        result: 'matched',
        collectedCards: [handCard],
        fieldAfter: state.field,
      },
    ];
    let field = state.field;
    let collected = [...state.collected, handCard];

    if (state.deck.length === 0) {
      return {
        newState: { hand: newHand, collected, field, deck: state.deck },
        events,
        specials,
      };
    }

    const drawnCard = state.deck[0]!;
    const newDeck = state.deck.slice(1);
    const drawResult = playCard(drawnCard, field, {
      targetCardId: options.targetAfterDraw,
      allowPpeok,
    });
    field = drawResult.newField;
    collected = [...collected, ...drawResult.collected];
    if (drawResult.ppeokMonth !== undefined) specials.ppeokMonth = drawResult.ppeokMonth;
    if (drawResult.ppeokRecoveredMonth !== undefined)
      specials.recoveredMonth = drawResult.ppeokRecoveredMonth;
    events.push({
      step: 'draw',
      card: drawnCard,
      result:
        drawResult.ppeokMonth !== undefined
          ? 'ppeok'
          : drawResult.ppeokRecoveredMonth !== undefined
            ? 'recovered'
            : drawResult.collected.length > 0
              ? 'matched'
              : 'placed',
      collectedCards: drawResult.collected,
      fieldAfter: field,
    });

    if (specials.recoveredMonth !== undefined) {
      const owner = options.stuckOwners?.[specials.recoveredMonth];
      const isOwn = owner !== undefined && owner === options.myActorKey;
      specials.isOwnRecover = isOwn;
      specials.stealPi += isOwn ? 2 : 1;
    }
    if (drawResult.collected.length > 0 && field.length === 0) {
      specials.sweep = true;
      if (!options.isLastTurn) specials.stealPi += 1;
    }

    return {
      newState: { hand: newHand, collected, field, deck: newDeck },
      events,
      specials,
    };
  }

  // 폭탄 카드 처리 — 폭탄 발동 후 손패에 추가된 보너스 카드.
  // 손패에서만 제거하고 더미 1장만 뒤집기 (매칭 시도 X, 카드 자체는 collected에 안 들어감)
  if (handCard.isBomb) {
    const events: TurnEvent[] = [];
    let field = state.field;
    let collected = state.collected;

    if (state.deck.length === 0) {
      return {
        newState: { hand: newHand, collected, field, deck: state.deck },
        events,
        specials,
      };
    }

    const drawnCard = state.deck[0]!;
    const newDeck = state.deck.slice(1);
    const drawResult = playCard(drawnCard, field, {
      targetCardId: options.targetAfterDraw,
      allowPpeok,
    });
    field = drawResult.newField;
    collected = [...collected, ...drawResult.collected];
    if (drawResult.ppeokMonth !== undefined) specials.ppeokMonth = drawResult.ppeokMonth;
    if (drawResult.ppeokRecoveredMonth !== undefined)
      specials.recoveredMonth = drawResult.ppeokRecoveredMonth;

    events.push({
      step: 'draw',
      card: drawnCard,
      result:
        drawResult.ppeokMonth !== undefined
          ? 'ppeok'
          : drawResult.ppeokRecoveredMonth !== undefined
            ? 'recovered'
            : drawResult.collected.length > 0
              ? 'matched'
              : 'placed',
      collectedCards: drawResult.collected,
      fieldAfter: field,
    });

    // 회수 시 stealPi (자뻑/일반 분기)
    if (specials.recoveredMonth !== undefined) {
      const owner = options.stuckOwners?.[specials.recoveredMonth];
      const isOwn = owner !== undefined && owner === options.myActorKey;
      specials.isOwnRecover = isOwn;
      specials.stealPi += isOwn ? 2 : 1;
    }

    // 싹쓸이 — 더미 매칭 결과로 바닥 비면
    if (drawResult.collected.length > 0 && field.length === 0) {
      specials.sweep = true;
      if (!options.isLastTurn) specials.stealPi += 1;
    }

    return {
      newState: { hand: newHand, collected, field, deck: newDeck },
      events,
      specials,
    };
  }

  // 폭탄 자동 감지 — 손패 같은 월 3장 + 바닥 1장 → 4장 한 번에 가져감 (rules-final.md §4)
  // 정통 룰: **흔들기 선언된 month만 폭탄 가능**. 미선언 시 일반 매칭 (1장만).
  // declineBomb=true면 흔들기 했어도 사용자가 [1장 내기] 선택 → 일반 매칭.
  const sameMonthInHand = state.hand.filter((c) => c.month === handCard.month);
  const fieldSameMonth = state.field.filter((c) => c.month === handCard.month);
  const monthShaken = options.shookMonths?.has(handCard.month) ?? false;
  const isBomb =
    allowPpeok &&
    sameMonthInHand.length >= 3 &&
    fieldSameMonth.length === 1 &&
    monthShaken &&
    !options.declineBomb;

  if (isBomb) {
    // 손패 그 월 모두 + 바닥 1장 = 4장 한 번에
    const bombHand = state.hand.filter((c) => c.month !== handCard.month);
    const bombField = state.field.filter((c) => c.month !== handCard.month);
    const bombCollected = [...sameMonthInHand, ...fieldSameMonth];
    let collected = [...state.collected, ...bombCollected];
    let field = bombField;

    specials.bomb = true;
    specials.stealPi += options.bombStealCount ?? 1;

    const events: TurnEvent[] = [
      {
        step: 'play-hand',
        card: handCard,
        result: 'matched',
        collectedCards: bombCollected,
        fieldAfter: field,
      },
    ];

    // 더미 비었으면 종료
    if (state.deck.length === 0) {
      if (field.length === 0 && !options.isLastTurn) {
        specials.sweep = true;
        specials.stealPi += 1;
      } else if (field.length === 0) {
        specials.sweep = true;
      }
      return {
        newState: { hand: bombHand, collected, field, deck: state.deck },
        events,
        specials,
      };
    }

    // 더미에서 1장 뒤집기 (일반 진행)
    const drawnCard = state.deck[0]!;
    const newDeck = state.deck.slice(1);
    const drawResult = playCard(drawnCard, field, {
      targetCardId: options.targetAfterDraw,
      allowPpeok,
    });
    field = drawResult.newField;
    collected = [...collected, ...drawResult.collected];
    if (drawResult.ppeokMonth !== undefined) specials.ppeokMonth = drawResult.ppeokMonth;
    if (drawResult.ppeokRecoveredMonth !== undefined)
      specials.recoveredMonth = drawResult.ppeokRecoveredMonth;

    events.push({
      step: 'draw',
      card: drawnCard,
      result:
        drawResult.ppeokMonth !== undefined
          ? 'ppeok'
          : drawResult.ppeokRecoveredMonth !== undefined
            ? 'recovered'
            : drawResult.collected.length > 0
              ? 'matched'
              : 'placed',
      collectedCards: drawResult.collected,
      fieldAfter: field,
    });

    // 회수 시 stealPi 추가 (폭탄 후 더미 회수 시)
    if (specials.recoveredMonth !== undefined) {
      const owner = options.stuckOwners?.[specials.recoveredMonth];
      const isOwn = owner !== undefined && owner === options.myActorKey;
      specials.isOwnRecover = isOwn;
      specials.stealPi += isOwn ? 2 : 1;
    }

    // 싹쓸이 — 폭탄 후 더미 매칭 결과로 바닥 비면
    if (drawResult.collected.length > 0 && field.length === 0) {
      specials.sweep = true;
      if (!options.isLastTurn) specials.stealPi += 1;
    }

    return {
      newState: { hand: bombHand, collected, field, deck: newDeck },
      events,
      specials,
    };
  }

  // 1. 손패 카드 → 바닥 매칭
  const handResult = playCard(handCard, state.field, {
    targetCardId: options.targetAfterHand,
    allowPpeok,
  });
  let field = handResult.newField;
  let collected = [...state.collected, ...handResult.collected];
  if (handResult.ppeokMonth !== undefined) specials.ppeokMonth = handResult.ppeokMonth;
  if (handResult.ppeokRecoveredMonth !== undefined)
    specials.recoveredMonth = handResult.ppeokRecoveredMonth;

  const events: TurnEvent[] = [
    {
      step: 'play-hand',
      card: handCard,
      result:
        handResult.ppeokMonth !== undefined
          ? 'ppeok'
          : handResult.ppeokRecoveredMonth !== undefined
            ? 'recovered'
            : handResult.collected.length > 0
              ? 'matched'
              : 'placed',
      collectedCards: handResult.collected,
      fieldAfter: field,
    },
  ];

  // 2. 더미 비었으면 여기서 끝
  if (state.deck.length === 0) {
    // 매칭 후 바닥 비면 싹쓸이. 단 마지막 턴이면 피 빼앗기 X (관례)
    if (handResult.collected.length > 0 && field.length === 0) {
      specials.sweep = true;
      if (!options.isLastTurn) specials.stealPi += 1;
    }
    return {
      newState: { hand: newHand, collected, field, deck: state.deck },
      events,
      specials,
    };
  }

  // 3. 더미에서 카드 1장 뒤집기
  const drawnCard = state.deck[0]!;
  const newDeck = state.deck.slice(1);

  // 4. 뒤집힌 카드 → 바닥 매칭
  const drawResult = playCard(drawnCard, field, {
    targetCardId: options.targetAfterDraw,
    allowPpeok,
  });
  field = drawResult.newField;
  collected = [...collected, ...drawResult.collected];
  if (drawResult.ppeokMonth !== undefined) specials.ppeokMonth = drawResult.ppeokMonth;
  if (drawResult.ppeokRecoveredMonth !== undefined)
    specials.recoveredMonth = drawResult.ppeokRecoveredMonth;

  events.push({
    step: 'draw',
    card: drawnCard,
    result:
      drawResult.ppeokMonth !== undefined
        ? 'ppeok'
        : drawResult.ppeokRecoveredMonth !== undefined
          ? 'recovered'
          : drawResult.collected.length > 0
            ? 'matched'
            : 'placed',
    collectedCards: drawResult.collected,
    fieldAfter: field,
  });

  // === 정통 룰 (Image #20 표) 후처리 ===
  // Case 3 (뻑): 바닥 1 + 손 1 (매칭) + 더미 같은 월 (placed) → 3장 모두 stuck
  //   - 손패 단계는 1장 매칭 (collected 2장)
  //   - 더미 단계는 placed (바닥에 같은 월 카드 X였으니 매칭 X)
  //   - drawnCard가 손패 같은 월 → stuck 발생
  const isCase3Ppeok =
    allowPpeok &&
    handResult.collected.length > 0 &&
    handCard.month === drawnCard.month &&
    drawResult.collected.length === 0 &&
    drawResult.ppeokMonth === undefined &&
    drawResult.ppeokRecoveredMonth === undefined;

  if (isCase3Ppeok) {
    // 손패 단계 collected를 되돌리고 + 더미 카드까지 모두 바닥에 stuck
    // (state.field에 손패 카드 + 더미 카드 추가 = 같은 월 3장 + 다른 카드들)
    field = [...state.field, handCard, drawnCard];
    collected = [...state.collected]; // 이번 턴 collected 모두 취소
    specials.ppeokMonth = handCard.month;
    specials.recoveredMonth = undefined;
    // events 마지막 (draw)의 fieldAfter도 갱신
    if (events.length > 0) {
      events[events.length - 1] = {
        ...events[events.length - 1]!,
        result: 'ppeok',
        fieldAfter: field,
      };
    }
    // 손패 단계 events도 'matched' → 'ppeok'로 (시각효과 일관성)
    if (events[0]) {
      events[0] = { ...events[0], result: 'ppeok', fieldAfter: field };
    }
  } else {
    // 5. 따닥 (Case 5) — 손패 매칭 + 더미 매칭 (둘 다 같은 월)
    const handMatchedSameMonth =
      handResult.collected.length > 0 && handCard.month === drawnCard.month;
    if (handMatchedSameMonth && drawResult.collected.length > 0) {
      specials.ttadak = true;
      specials.stealPi += 1;
    }

    // 6. 쪽 (Case 1) — 손패 placed + 더미가 손패와 같은 월에서 매칭
    const handPlaced =
      handResult.collected.length === 0 &&
      handResult.ppeokMonth === undefined &&
      handResult.ppeokRecoveredMonth === undefined;
    if (handPlaced && drawnCard.month === handCard.month && drawResult.collected.length > 0) {
      specials.jjok = true;
      specials.stealPi += 1;
    }

    // 6-A. 회수 시 stealPi 추가 — 자뻑이면 +2장, 일반 회수면 +1장
    if (specials.recoveredMonth !== undefined) {
      const owner = options.stuckOwners?.[specials.recoveredMonth];
      const isOwn = owner !== undefined && owner === options.myActorKey;
      specials.isOwnRecover = isOwn;
      specials.stealPi += isOwn ? 2 : 1;
    }

    // 7. 싹쓸이 — 매칭 후 바닥 빔. 마지막 턴이면 피 빼앗기 X (관례)
    const totalCollected = handResult.collected.length + drawResult.collected.length;
    if (totalCollected > 0 && field.length === 0) {
      specials.sweep = true;
      if (!options.isLastTurn) specials.stealPi += 1;
    }
  }

  return {
    newState: { hand: newHand, collected, field, deck: newDeck },
    events,
    specials,
  };
}

/**
 * 사용자 선택 단계.
 * - 'hand': 손패가 바닥의 같은 월 카드 2장과 매칭하는데 종류가 다른 경우
 * - 'draw': 더미 카드가 바닥의 같은 월 카드 2장과 매칭하는데 종류가 다른 경우
 */
export type TurnSelectionStage = 'hand' | 'draw';

export interface TurnSelectionRequest {
  stage: TurnSelectionStage;
  /** 사용자가 선택할 후보 카드들 (바닥의 같은 월 카드들) */
  candidates: Card[];
  /** stage='draw'일 때 — 더미에서 뒤집힌 카드 (사용자에게 표시용) */
  drawnCard?: Card;
}

export interface SimulateTurnResult {
  /** 사용자 선택이 필요하면 set. 둘 다 OK면 undefined. */
  needsSelection?: TurnSelectionRequest;
  /** 사용자 선택 끝났거나 처음부터 자동 처리 가능했으면 set */
  result?: TurnResult;
}

/**
 * 손패/더미 단계의 매칭 종류를 검사해서 사용자 선택이 필요한지 판단.
 * 모든 선택이 결정되면 `executeTurn`을 호출해 결과 반환.
 *
 * 선택 필요 조건: 매칭 카드 2장 + 종류 다름 (`hasDifferentMatchKinds`).
 * 같은 종류 2장(피 2장 등)은 자동 첫 번째.
 *
 * 솔로/멀티(서버) 공통 사용. 정통 룰 (rules-final.md §1).
 */
export function simulateOrNeedsSelection(
  state: TurnState,
  handCardId: string,
  options: TurnOptions = {},
): SimulateTurnResult {
  const handCardIndex = state.hand.findIndex((c) => c.id === handCardId);
  if (handCardIndex < 0) {
    throw new Error(`Card "${handCardId}" not in hand`);
  }
  const handCard = state.hand[handCardIndex]!;

  // 폭탄/조커 카드는 선택 불필요 — executeTurn 직접 호출
  if (handCard.isBomb || handCard.isJoker) {
    return { result: executeTurn(state, handCardId, options) };
  }

  // 1. 손패 매칭 검사 — targetAfterHand 미지정 + 다른 종류 2장이면 선택 필요
  if (options.targetAfterHand === undefined) {
    const handMatches = state.field.filter((c) => c.month === handCard.month);
    if (handMatches.length === 2 && hasDifferentMatchKinds(handMatches)) {
      // drawnCard도 함께 반환 — 클라가 Phase 1~3 prebuild 재생 후 모달 표시
      const drawnCard = state.deck.length > 0 ? state.deck[0] : undefined;
      return {
        needsSelection: {
          stage: 'hand',
          candidates: handMatches,
          drawnCard,
        },
      };
    }
  }

  // 2. 더미 단계 검사 — 손패 단계 적용 후 더미 카드 매칭 시뮬레이션
  if (state.deck.length > 0 && options.targetAfterDraw === undefined) {
    const drawnCard = state.deck[0]!;
    // 손패 단계 적용 후 field 시뮬레이션
    const fieldAfterHand = simulateFieldAfterHand(
      state.field,
      handCard,
      options.targetAfterHand,
    );
    const drawMatches = fieldAfterHand.filter(
      (c) => c.month === drawnCard.month,
    );
    if (drawMatches.length === 2 && hasDifferentMatchKinds(drawMatches)) {
      return {
        needsSelection: {
          stage: 'draw',
          candidates: drawMatches,
          drawnCard,
        },
      };
    }
  }

  // 모든 선택 결정됨 — 실제 executeTurn 호출
  return { result: executeTurn(state, handCardId, options) };
}

/**
 * 손패 단계 후 field 상태 시뮬레이션 (더미 매칭 사전 검사용).
 * 실제 mutation은 X — 매칭/뻑/회수 결과만 계산해 새 field 반환.
 */
export function simulateFieldAfterHand(
  field: readonly Card[],
  handCard: Card,
  targetAfterHand: string | undefined,
): Card[] {
  const matches = field.filter((c) => c.month === handCard.month);
  if (matches.length === 0) {
    // placed
    return [...field, handCard];
  }
  if (matches.length === 1) {
    // matched — 둘 다 collected (field에서 제거)
    return field.filter((c) => c.id !== matches[0]!.id);
  }
  if (matches.length === 2) {
    // 1장 선택 매칭 — target 또는 첫 번째
    const target = targetAfterHand
      ? (matches.find((c) => c.id === targetAfterHand) ?? matches[0]!)
      : matches[0]!;
    return field.filter((c) => c.id !== target.id);
  }
  if (matches.length === 3) {
    // 회수 — 같은 월 모두 collected
    return field.filter((c) => c.month !== handCard.month);
  }
  return [...field, handCard];
}

// matching.ts의 hasDifferentMatchKinds 재구현 (circular import 방지)
function hasDifferentMatchKinds(matches: readonly Card[]): boolean {
  if (matches.length < 2) return false;
  const sigOf = (c: Card) =>
    `${c.kind}|${c.ddiKind ?? ''}|${c.isBigwang ? 1 : 0}|${c.isSsangPi ? 1 : 0}|${c.isGoDori ? 1 : 0}`;
  const first = sigOf(matches[0]!);
  return matches.some((c) => sigOf(c) !== first);
}

/**
 * 게임 종료 조건: 모든 손패와 더미가 비었음.
 */
export function isGameOver(hands: readonly (readonly Card[])[], deck: readonly Card[]): boolean {
  return deck.length === 0 && hands.every((h) => h.length === 0);
}

/**
 * 다음 턴 플레이어 인덱스.
 */
export function nextTurnIndex(currentIndex: number, playerCount: number): number {
  return (currentIndex + 1) % playerCount;
}
