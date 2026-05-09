import { createContext, useContext } from 'react';
import {
  FLY_DURATION_HAND_TO_FIELD,
  FLY_DURATION_TO_COLLECTED,
  FLY_TO_SLOT_DURATION,
} from './animationTiming.ts';

/**
 * 현재 진행 중인 카드 비행 페이즈.
 *  - idle: 시퀀스 중 아님 (기본 빠른 spring)
 *  - phase1: 손패 → 바닥
 *  - phase3: 더미 → 빈 슬롯
 *  - phase4: 바닥 → 점수판 (한 장씩 stagger)
 */
export type AnimationPhase = 'idle' | 'phase1' | 'phase3' | 'phase4';

export const AnimationPhaseContext = createContext<AnimationPhase>('idle');

export function useAnimationPhase(): AnimationPhase {
  return useContext(AnimationPhaseContext);
}

/**
 * Card 컴포넌트의 framer-motion layout 보간 시간.
 * phase에 따라 다른 duration 적용 — 같은 layoutId 카드의 위치 이동에 사용됨.
 */
export function getLayoutDuration(phase: AnimationPhase): number {
  switch (phase) {
    case 'phase1':
      return FLY_DURATION_HAND_TO_FIELD;
    case 'phase3':
      return FLY_TO_SLOT_DURATION;
    case 'phase4':
      return FLY_DURATION_TO_COLLECTED;
    case 'idle':
    default:
      return 0.3;
  }
}
