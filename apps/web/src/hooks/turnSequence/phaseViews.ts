import type { Card, RoomView } from '@gostop/shared';
import { getCardById } from '@gostop/shared';

/**
 * 4-phase 시퀀스 단계별로 사용하는 중간 view 빌더.
 *
 * 각 phase에서 사용자에게 보이는 view를 점진적으로 진행시키기 위한 헬퍼.
 * useMultiTurnSequence가 phase별로 setDisplayView 호출 시 이 빌더로 생성.
 *
 * 의도된 흐름:
 *   prev (Phase 1-A에서 표시)
 *   → phase1View (Phase 1-B: 손패 카드만 field에 추가)
 *   → phase3View (Phase 3: drawnCard도 field에 추가, deckCount -1)
 *   → incoming (Phase 4: 진짜 server view — 매칭/collected 결과 적용)
 */

/**
 * Phase 1-B 시작 시 swap할 view.
 *
 * prev 기반 + 본인 손패에서 handCards 모두 제거 + field에 추가 (dedupe).
 * 매칭/collected 결과는 prev 그대로 — Phase 4에서 한꺼번에 적용.
 *
 * **폭탄 발동 시 handCards가 3장** (같은 month) → 3장 모두 손→바닥 비행.
 * **일반 시 1장**.
 *
 * 카드가 prev.field에 이미 있으면 중복 추가 X (key 중복 방지).
 */
export function buildPhase1View(prev: RoomView, handCards: Card[]): RoomView {
  const handCardIds = new Set(handCards.map((c) => c.id));
  const prevFieldIds = new Set(prev.field.map((c) => c.id));
  const newField = [
    ...prev.field,
    ...handCards.filter((c) => !prevFieldIds.has(c.id)),
  ];
  return {
    ...prev,
    players: prev.players.map((p) =>
      p.userId === prev.myUserId
        ? { ...p, hand: (p.hand ?? []).filter((c) => !handCardIds.has(c.id)) }
        : p,
    ),
    field: newField,
  };
}

/**
 * Phase 3 시작 시 swap할 view.
 *
 * phase1View 기반 + drawnCard를 field에 추가 + deckCount -1.
 * drawnCard는 floating overlay와 일반 매핑 motion.div 양쪽에서 참조됨
 * (일반 매핑은 flippingCardId === card.id면 opacity 0으로 숨김).
 *
 * drawnCard를 찾을 수 없으면 phase1View 그대로 반환.
 */
export function buildPhase3View(
  phase1View: RoomView,
  drawnCardId: string,
  incoming: RoomView,
): RoomView {
  const drawnCard = findCardInView(incoming, drawnCardId);
  if (!drawnCard) return phase1View;

  const alreadyInField = phase1View.field.some((c) => c.id === drawnCard.id);
  return {
    ...phase1View,
    field: alreadyInField ? phase1View.field : [...phase1View.field, drawnCard],
    deckCount: Math.max(0, phase1View.deckCount - 1),
  };
}

/**
 * AI/상대 turn Phase 1-A 시점에 사용할 view — turnUserId player의 hand에 handCard 1장
 * fake로 mount. OpponentSlot이 그 카드를 layoutId source로 표시 → Phase 1-B에서
 * phase1View로 swap 시 hand에서 빠지고 field에 추가되어 layoutId 비행.
 *
 * 본인 turn에서는 phase1View와 동일 (사용 안 됨).
 */
export function buildPhase1ViewWithFakeHand(
  prev: RoomView,
  handCards: Card[],
): RoomView {
  return {
    ...prev,
    players: prev.players.map((p) =>
      p.userId === prev.turnUserId
        ? { ...p, hand: handCards }
        : p,
    ),
  };
}

/**
 * needsSelection 응답 시 useMultiPlayCard가 만드는 prebuild view.
 *
 * server commit 없이 클라가 임시로 손패+더미가 바닥에 placed된 상태 시각화.
 * useMultiTurnSequence가 이 view를 받아 phase 1~3 재생 후 모달 발화.
 *
 * 손패에서 handCard 제거 + field에 handCard 추가 (+ drawnCard 있으면 field에 추가, deckCount -1).
 */
export function buildPrebuildView(
  prev: RoomView,
  handCard: Card,
  drawnCard: Card | undefined,
): RoomView {
  const base: RoomView = {
    ...prev,
    players: prev.players.map((p) =>
      p.userId === prev.myUserId
        ? { ...p, hand: (p.hand ?? []).filter((c) => c.id !== handCard.id) }
        : p,
    ),
    field: [...prev.field, handCard],
  };

  if (!drawnCard) return base;

  return {
    ...base,
    field: [...base.field, drawnCard],
    deckCount: Math.max(0, base.deckCount - 1),
  };
}

/**
 * Phase 4 view — incoming 기반인데 빼앗은 카드들 (stealPiCards)을 본인 collected에서 제거하고
 * 원래 owner(from) collected에 다시 추가. Phase 4 시점에 매칭 카드만 본인 collected로 비행.
 * Phase 5에서 phase4View → incoming swap 시 stealPi 카드만 상대→본인 collected로 비행.
 *
 * stealPiCards가 비어있으면 incoming 그대로 반환.
 */
export function buildPhase4View(incoming: RoomView): RoomView {
  const stealPiCards = incoming.lastTurnSpecials?.stealPiCards ?? [];
  if (stealPiCards.length === 0) return incoming;

  // stealPiCards: { from: 원래 owner, to: 빼앗아간 player, cardId }
  // incoming은 이미 from에서 빠지고 to에 있음. phase4View는 다시 from으로 되돌림.
  const stolenByPlayer = new Map<string, Map<string, Card>>(); // from → cardId → Card
  for (const item of stealPiCards) {
    const toPlayer = incoming.players.find((p) => p.userId === item.to);
    const card = toPlayer?.collected.find((c) => c.id === item.cardId);
    if (!card) continue;
    const map = stolenByPlayer.get(item.from) ?? new Map<string, Card>();
    map.set(item.cardId, card);
    stolenByPlayer.set(item.from, map);
  }
  if (stolenByPlayer.size === 0) return incoming;

  const stolenCardIds = new Set(stealPiCards.map((s) => s.cardId));
  return {
    ...incoming,
    players: incoming.players.map((p) => {
      const restoredFromMap = stolenByPlayer.get(p.userId);
      if (restoredFromMap) {
        // 원래 owner: 빼앗긴 카드들 복원
        return {
          ...p,
          collected: [...p.collected, ...restoredFromMap.values()],
        };
      }
      // to player: 빼앗아간 카드들 제거 (Phase 5에서 다시 들어옴)
      return {
        ...p,
        collected: p.collected.filter((c) => !stolenCardIds.has(c.id)),
      };
    }),
  };
}

/** 카드 ID로 view 안에서 카드 객체 찾기 (field → 모든 player의 collected/hand 순). */
export function findCardInView(view: RoomView, cardId: string): Card | undefined {
  const inField = view.field.find((c) => c.id === cardId);
  if (inField) return inField;
  for (const p of view.players) {
    const inCollected = p.collected.find((c) => c.id === cardId);
    if (inCollected) return inCollected;
    const inHand = p.hand?.find((c) => c.id === cardId);
    if (inHand) return inHand;
  }
  return undefined;
}

/**
 * prev → incoming에서 손패에서 빠진 카드들 (폭탄 시 3장, 일반 시 1장).
 *
 * - 본인 turn: prev.hand vs incoming.hand 비교 (빠진 카드 모두 반환)
 * - AI/상대 turn: server가 hand를 마스킹하므로 history 마지막 play-card cardId로 fallback (1장만)
 *
 * @returns 카드 배열 — 폭탄이면 3장(같은 month), 일반이면 1장. 빈 배열이면 변화 없음.
 */
export function findHandCardsRemoved(
  prev: RoomView,
  incoming: RoomView,
): Card[] {
  const prevMe = prev.players.find((p) => p.userId === prev.myUserId);
  const incomingMe = incoming.players.find((p) => p.userId === incoming.myUserId);
  const fromHand: Card[] = [];
  if (prevMe?.hand && incomingMe?.hand) {
    const incomingIds = new Set(incomingMe.hand.map((c) => c.id));
    for (const c of prevMe.hand) {
      if (!incomingIds.has(c.id)) fromHand.push(c);
    }
  }
  if (fromHand.length > 0) return fromHand;
  // fallback — history에 새 play-card 추가됐으면 그 카드 1장 (AI turn)
  const prevHistLen = prev.history?.length ?? 0;
  const incomingHist = incoming.history ?? [];
  if (incomingHist.length > prevHistLen) {
    const newItem = incomingHist[incomingHist.length - 1];
    if (newItem?.type === 'play-card') {
      const card = getCardById(newItem.cardId);
      if (card) return [card];
    }
  }
  return [];
}

/** @deprecated 후방 호환용 — findHandCardsRemoved의 첫 번째 카드 반환. 새 코드는 findHandCardsRemoved 사용. */
export function findHandCardObj(prev: RoomView, incoming: RoomView): Card | null {
  const cards = findHandCardsRemoved(prev, incoming);
  return cards[0] ?? null;
}

/**
 * 더미에서 뒤집힌 카드 ID.
 *
 * deckCount 감소 + field/collected에 추가된 카드 중 손패 카드(excludeId) 제외 마지막.
 * collected fallback은 prev.field에 있던 카드도 제외 — 매칭으로 collected에 간
 * "기존 field 카드"가 아닌 "deck에서 새로 뒤집힌 카드"만 반환해야 함.
 */
export function findDrawnCard(
  prev: RoomView,
  incoming: RoomView,
  excludeId: string | null,
): string | null {
  if (prev.deckCount <= incoming.deckCount) return null;

  const prevFieldIds = new Set(prev.field.map((c) => c.id));
  const newFieldCards: Card[] = incoming.field.filter(
    (c) => !prevFieldIds.has(c.id) && c.id !== excludeId,
  );
  if (newFieldCards.length > 0) {
    return newFieldCards[newFieldCards.length - 1]!.id;
  }

  for (const p of incoming.players) {
    const prevP = prev.players.find((pp) => pp.userId === p.userId);
    if (!prevP) continue;
    const prevCollectedIds = new Set(prevP.collected.map((c) => c.id));
    const added = p.collected.filter(
      (c) =>
        !prevCollectedIds.has(c.id) &&
        c.id !== excludeId &&
        !prevFieldIds.has(c.id), // prev.field에 있던 매칭 카드 제외 (deck에서 온 카드만)
    );
    if (added.length > 0) return added[added.length - 1]!.id;
  }
  return null;
}
