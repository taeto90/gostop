import type { RoomView } from '@gostop/shared';
import { useDevTestStore } from '../../../stores/devTestStore.ts';
import {
  getOrderedRealMembers,
  makePlaceholderMembers,
  type MemberLike,
} from './types.ts';

/**
 * 표시할 멤버 list 생성: 본인 → 다른 player → spectator → dev placeholder.
 * dev test fill이 실제 인원보다 많으면 placeholder로 채움.
 *
 * LiveKit hooks를 사용하지 않으므로 context 없이도 호출 가능.
 */
export function useVideoMembers(view: RoomView, maxTiles?: number): MemberLike[] {
  const testFillCount = useDevTestStore((s) => s.videoFillCount);
  const real = getOrderedRealMembers(view);
  const fillCount = Math.max(0, testFillCount - real.length);
  const placeholders = makePlaceholderMembers(fillCount);
  const merged = [...real, ...placeholders];
  return maxTiles != null ? merged.slice(0, maxTiles) : merged;
}
