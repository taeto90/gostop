/**
 * 화면 레이아웃 사이즈 변수 모음.
 *
 * 손패/바닥 카드 크기, 점수판 폭, 손패 영역 높이 등 모바일과 PC 분리 값을
 * 한 곳에서 관리. 사이즈 조절은 이 파일만 건드리면 됨.
 *
 * 분기 기준: rootW < COMPACT_BREAKPOINT 면 모바일 모드.
 */

/** PC vs 모바일 분기 임계값 (px). 미만이면 모바일 가로 모드. */
export const COMPACT_BREAKPOINT = 950;

// ============================================================
// 손패 (MyHand)
// ============================================================
/**
 * 손패 카드 최대 너비 (px). 화면이 충분히 크면 이 값까지 커짐.
 * widthBased / heightBased 자동 계산이 더 작으면 그쪽이 우선 적용.
 */
export const HAND_CARD_MAX_WIDTH = {
  pc: 100,
  mobile: 90,
} as const;

/** 손패 카드 최소 너비 (px). 매우 작은 화면에서 fallback. */
export const HAND_CARD_MIN_WIDTH = 28;

/** 손패 카드 사이 가로 간격 (px). PC/모바일 동일. (2026-06: 22→11 — 카드 키우기) */
export const HAND_CARD_GAP = 11;

// ============================================================
// 손패 영역 (전체 section)
// ============================================================
/**
 * 손패 영역이 화면 height에서 차지하는 비율.
 * shortMobile = rootH < 400 인 매우 짧은 화면용 (비중 더 높임).
 */
export const HAND_AREA_RATIO = {
  pc: 0.2,
  mobile: 0.285, // 2026-06: 0.24→0.285 — 모바일 손패 카드 확대 (heightBased 결정자)
  shortMobile: 0.32,
} as const;

/** 손패 영역 최소 height (px). 비율 계산 결과가 너무 작아지지 않게. */
export const HAND_AREA_MIN = 85;

/** 손패 영역 최대 height (px). 비율 계산 결과가 너무 커지지 않게. */
export const HAND_AREA_MAX = {
  pc: 170,
  mobile: 135,
} as const;

// ============================================================
// 바닥 게임판 (CenterField)
// ============================================================
/**
 * 바닥 카드 최대 너비 (px). heightBased / widthBased 자동 계산이
 * 더 작으면 그쪽이 우선. 모바일이 큰 이유: heightBased로 자동 제한되므로 cap은 넉넉히.
 */
export const FIELD_CARD_MAX_WIDTH = {
  pc: 117,
  mobile: 52, // 모바일 — 손패(간격 11px·10장 기준 ~52px)와 동일 크기
} as const;

/** 바닥 카드 최소 너비 (px). */
export const FIELD_CARD_MIN_WIDTH = 36;

/**
 * 바닥 카드 사이 가로 빈 공간을 cardW의 N 배로.
 * 즉 col 사이 거리 = cardW × (1 + N).
 */
export const FIELD_HORIZONTAL_GAP_RATIO = 1.5;

/**
 * PC 전용: 바닥 카드 사이 세로 빈 공간을 cardH의 N 배로.
 * row 중심 사이 거리 = cardH × (1 + N).
 */
export const FIELD_VERTICAL_GAP_RATIO = 0.5;

/**
 * 모바일 전용: 두 row 중심 거리 (cardH 단위).
 * 0.6 → row 1과 2가 더미와 겹쳐 보이는 2행 형태.
 * 1.0 이상이면 더미가 두 row 사이에 정확히 끼는 형태.
 */
export const FIELD_MOBILE_ROW_DISTANCE_RATIO = 0.6;

/**
 * 모바일 전용: cardW 계산용 farFactorH.
 * row 외곽 카드 끝까지 ÷ cardH. 작을수록 카드 더 큼 (위/아래 살짝 잘릴 수 있음).
 */
export const FIELD_MOBILE_FAR_FACTOR_H = 1.1;

/**
 * Stack 시 같은 월 카드의 X-offset = cardW × N.
 * 0.25 → 위 카드가 75% 덮고, 아래 카드의 좌측 25%만 보임.
 */
export const FIELD_STACK_OFFSET_RATIO = 0.25;

// ============================================================
// 점수판 (CollectedPanel)
// ============================================================
/** 좌측 점수판(딴패) 컬럼 너비 (px). 50% 겹침 카드 10장/줄 기준 (PC 53px·모바일 30px). */
export const COLLECTED_PANEL_WIDTH = {
  pc: 312,
  mobile: 196,
} as const;

/** 점수판 안에서 카드 표시 너비 (px) — 라벨 위 + 50% 겹침 (PC/모바일 동일 구조). */
export const COLLECTED_CARD_WIDTH = {
  pc: 53,
  mobile: 30,
} as const;

// ============================================================
// 결과 화면 (ResultView)
// ============================================================
/** 결과 화면에서 딴패 카드 너비 (px). */
export const RESULT_CARD_WIDTH = {
  pc: 80,
  mobile: 44,
} as const;

// ============================================================
// 화상채팅 타일 (LiveKit — MediaTilesPanel)
// ============================================================
/** 타일 그리드가 보여줄 최대 인원 */
export const VIDEO_SIDEBAR_MAX_TILES = 5;
/**
 * 테스트용 placeholder 인원 — `stores/devTestStore.ts`에서 동적 관리.
 * Settings 모달의 "개발 테스트" 섹션에서 토글. 운영 배포 시 자동 0 (DEV가 아니므로).
 */

// ============================================================
// PC 새 게임 화면 (2026-06 시니어 친화 개편)
// ============================================================
/** 우측 통합 사이드바(화상/참여자/채팅) 펼침 폭 (px). */
export const SIDEBAR_WIDTH_PC = 320;
/** 우측 통합 사이드바 접힘 폭 (px) — 토글 바만. */
export const SIDEBAR_COLLAPSED_WIDTH_PC = 36;
/** 상대 보드 딴패 카드 너비 상한 (px) — 겹침 50% 고정, 폭 부족 시 자동 축소 (CollectedGroupsRow). */
export const OPPONENT_COLLECTED_CARD_WIDTH = 42;
/** 상대 fake-hand 카드 너비 (px) — Phase 1-B 비행 source (staging 중에만 잠깐 렌더). */
export const OPPONENT_HAND_MINI_WIDTH = 36;

// ============================================================
// 헬퍼
// ============================================================
/** rootW 가 모바일 가로 모드인가? (rootW=0 일 땐 PC로 간주) */
export const isCompactWidth = (rootW: number): boolean =>
  rootW > 0 && rootW < COMPACT_BREAKPOINT;
