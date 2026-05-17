/**
 * 카드 비행 시퀀스 타이밍 (초 단위).
 *
 * 사용자 요청 (디버깅 단계 — 느린 속도): 모든 주요 비행 = 3초.
 * 나중에 만족스러운 페이스로 수정할 때 이 파일 값만 조정하면 됨.
 *
 * 시퀀스 흐름:
 *   Phase 1: 손패 → 바닥 stack 위치로 비행 (살짝 흔들리며)
 *   ↓ Phase 2: 착지 순간 "착" 사운드 (별도 duration 없음)
 *   ↓ INTER_PHASE_DELAY
 *   Phase 3: 더미 카드 3D flip → 확대 → 축소되며 빈자리로 비행
 *   ↓ INTER_PHASE_DELAY
 *   Phase 4: 매칭된 카드들이 한 장씩 점수판으로 비행 (COLLECT_STAGGER 간격)
 */

// ============================================================
// Phase 1 — 손패 확대 → 바닥 비행
// 일반 게임 모드 base — 2026-05-17 사용자 요청으로 이전 값의 ÷2 (2배 빠름).
// 테스트 모드는 devTestStore에서 0.5 선택 시 원래 속도로 슬로우모션 디버깅 가능.
// ============================================================
/** Phase 1-A: 손패 카드를 그 자리에서 확대 (다른 phase 대비 짧게) */
export const HAND_PEAK_DURATION = 0.15;
/** Phase 1-B: 확대된 카드가 바닥으로 비행 (축소되면서) */
export const FLY_DURATION_HAND_TO_FIELD = 0.3;
/** 손패 확대 시 배율 */
export const HAND_PEAK_SCALE = 1.4;
/** 비행 중 좌우 흔들기 회전 각도 키프레임 (도 단위) */
export const FLY_WOBBLE_ANGLES = [0, -4, 4, -3, 3, -1, 0];

/** Phase 1 전체 길이 = peak + fly */
export const PHASE_1_TOTAL_DURATION = HAND_PEAK_DURATION + FLY_DURATION_HAND_TO_FIELD;

// ============================================================
// Phase 3 — 더미 flip + 확대 + 비행
// ============================================================
/** 더미 카드 3D rotateY (뒷면 → 앞면) */
export const FLIP_DURATION = 0.3;
/** flip 완료 후 확대 상태 유지 */
export const SCALE_PEAK_DURATION = 0.5;
/** 확대된 카드가 원래 사이즈로 축소되며 빈자리로 비행 */
export const FLY_TO_SLOT_DURATION = 0.3;
/** 확대 시 배율 */
export const FLIP_PEAK_SCALE = 2;

// ============================================================
// Phase 4 — 점수판 비행
// ============================================================
/** 카드 한 장당 비행 시간 — Phase 4 (바닥→점수판). 거리가 길어 다른 비행보다 길게. */
export const FLY_DURATION_TO_COLLECTED = 1.0;
/** 카드 사이 출발 간격 (한 장이 출발하고 다음 카드까지) */
export const COLLECT_STAGGER = 0.15;

// ============================================================
// 공통
// ============================================================
/** 단계 사이 간격 (Phase 2 끝 → Phase 3 시작, Phase 3 끝 → Phase 4 시작) */
export const INTER_PHASE_DELAY = 0.75;

// ============================================================
// 헬퍼
// ============================================================
/** Phase 3 전체 길이 = flip + peak + fly */
export const PHASE_3_TOTAL_DURATION =
  FLIP_DURATION + SCALE_PEAK_DURATION + FLY_TO_SLOT_DURATION;

// ============================================================
// 속도 배수 (테스트 모드 — devTestStore가 이 값을 set)
// ============================================================
let speedMultiplier = 1;
/** 모든 duration을 배수로 ÷. 1 = 정상, 2 = 2배 빠름, 0.5 = 2배 느림 */
export function setSpeedMultiplier(m: number): void {
  speedMultiplier = m > 0 ? m : 1;
}
export function getSpeedMultiplier(): number {
  return speedMultiplier;
}
/** 초 단위 duration에 multiplier 적용 (÷). 1× = 그대로 */
export function applySpeed(seconds: number): number {
  return seconds / speedMultiplier;
}

/** ms 단위로 변환 + 속도 배수 적용 */
export const sec = (s: number): number => Math.round(applySpeed(s) * 1000);

// ============================================================
// 모달 공통 — framer-motion spring transition (게임 텐션에 맞게 빠른 spring)
// ============================================================
export const MODAL_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 28,
  mass: 0.6,
};

/** 모달 백드롭 페이드 + 컨텐츠 scale 등장. tween fade + spring scale 조합. */
export const MODAL_SCALE_INITIAL = { scale: 0.92, opacity: 0 } as const;
export const MODAL_SCALE_ANIMATE = { scale: 1, opacity: 1 } as const;
export const MODAL_SCALE_EXIT = { scale: 0.92, opacity: 0 } as const;
