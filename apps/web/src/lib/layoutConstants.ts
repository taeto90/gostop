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

/** 손패 카드 사이 가로 간격 (px). PC/모바일 동일. */
export const HAND_CARD_GAP = 22;

// ============================================================
// 손패 영역 (전체 section)
// ============================================================
/**
 * 손패 영역이 화면 height에서 차지하는 비율.
 * shortMobile = rootH < 400 인 매우 짧은 화면용 (비중 더 높임).
 */
export const HAND_AREA_RATIO = {
  pc: 0.2,
  mobile: 0.24,
  shortMobile: 0.28,
} as const;

/** 손패 영역 최소 height (px). 비율 계산 결과가 너무 작아지지 않게. */
export const HAND_AREA_MIN = 85;

/** 손패 영역 최대 height (px). 비율 계산 결과가 너무 커지지 않게. */
export const HAND_AREA_MAX = {
  pc: 170,
  mobile: 130,
} as const;

// ============================================================
// 바닥 게임판 (CenterField)
// ============================================================
/**
 * 바닥 카드 최대 너비 (px). heightBased / widthBased 자동 계산이
 * 더 작으면 그쪽이 우선. 모바일이 큰 이유: heightBased로 자동 제한되므로 cap은 넉넉히.
 */
export const FIELD_CARD_MAX_WIDTH = {
  pc: 70,
  mobile: 144,
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
/** 좌측 점수판(딴패) 컬럼 너비 (px). */
export const COLLECTED_PANEL_WIDTH = {
  pc: 200,
  mobile: 140,
} as const;

/** 점수판 안에서 카드 표시 너비 (px). */
export const COLLECTED_CARD_WIDTH = {
  pc: 38,
  mobile: 24,
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
// 화상채팅 사이드바 (LiveKit)
// ============================================================
/**
 * 사이드바 height 100% 기준 비율 — 5명 카드 + 위아래 패딩 + 사이 갭.
 * 5*17 + 4*2 + 2*3.5 = 85 + 8 + 7 = 100%. (인원 적을 땐 가운데 정렬로 빈 공간)
 */
/** 각 비디오 카드 height (사이드바 height 대비) */
export const VIDEO_TILE_HEIGHT_RATIO = 0.17;
/** 비디오 카드 사이 갭 (사이드바 height 대비) */
export const VIDEO_TILE_GAP_RATIO = 0.02;
/** 사이드바 위/아래 패딩 (사이드바 height 대비) */
export const VIDEO_SIDEBAR_VERTICAL_PADDING_RATIO = 0.035;
/** 사이드바 좌우 패딩 (px). 카드 width와 별개로 좌우 공간 확보 */
export const VIDEO_SIDEBAR_HORIZONTAL_PADDING = 6;
/** 비디오 카드 aspect ratio (가로:세로) — 16:9 */
export const VIDEO_TILE_ASPECT_RATIO = 16 / 9;
/** 사이드바가 보여줄 최대 인원 */
export const VIDEO_SIDEBAR_MAX_TILES = 5;
/**
 * 테스트용 placeholder 인원 — `stores/devTestStore.ts`에서 동적 관리.
 * Settings 모달의 "개발 테스트" 섹션에서 토글. 운영 배포 시 자동 0 (DEV가 아니므로).
 */

/** 사이드바 collapse 시 가로폭 (토글 버튼만). */
export const VIDEO_SIDEBAR_COLLAPSED_WIDTH = 36;
/** 사이드바 toggle 버튼 + 위쪽 여유 공간 (펼친/접힌 둘 다 동일). */
export const SIDEBAR_TOGGLE_TOP_GAP = 32;
/** 사이드바 펼침 시 fallback 폭 (px). 동적 계산 전 첫 렌더 시 사용 */
export const VIDEO_SIDEBAR_FALLBACK_WIDTH = 200;

// ============================================================
// 헬퍼
// ============================================================
/** rootW 가 모바일 가로 모드인가? (rootW=0 일 땐 PC로 간주) */
export const isCompactWidth = (rootW: number): boolean =>
  rootW > 0 && rootW < COMPACT_BREAKPOINT;
