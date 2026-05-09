import type { RoomView } from '@gostop/shared';

/** 사이드바/모달이 표시하는 멤버의 최소 형태. player/spectator/placeholder 공통. */
export interface MemberLike {
  userId: string;
  nickname: string;
  emojiAvatar: string;
}

const PLACEHOLDER_PREFIX = '__test-';
const PLACEHOLDER_AVATARS = ['🐶', '🐱', '🦊', '🐰', '🐻'];

/** placeholder(가짜) 멤버인지 — userId prefix로 판별 */
export function isPlaceholder(userId: string): boolean {
  return userId.startsWith(PLACEHOLDER_PREFIX);
}

/** dev test용 가짜 멤버 N개 생성. */
export function makePlaceholderMembers(count: number): MemberLike[] {
  return Array.from({ length: count }, (_, i) => ({
    userId: `${PLACEHOLDER_PREFIX}${i}__`,
    nickname: `테스트${i + 1}`,
    emojiAvatar: PLACEHOLDER_AVATARS[i] ?? '👤',
  }));
}

/** 본인 → 다른 player → spectator 순으로 정렬된 실제 멤버. */
export function getOrderedRealMembers(view: RoomView): MemberLike[] {
  const me = view.players.filter((p) => p.userId === view.myUserId);
  const others = view.players.filter((p) => p.userId !== view.myUserId);
  return [...me, ...others, ...view.spectators].map((p) => ({
    userId: p.userId,
    nickname: p.nickname,
    emojiAvatar: p.emojiAvatar,
  }));
}
