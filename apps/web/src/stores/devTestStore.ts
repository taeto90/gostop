import { create } from 'zustand';
import { setSpeedMultiplier } from '../lib/animationTiming.ts';

/**
 * 개발/테스트용 store. 운영 배포 시 영향 없음 (default 값이 dev 환경에서만 활성).
 *
 * `videoFillCount`: 화상채팅 사이드바/모바일 모달에 placeholder를 N개까지 채워
 * 실제 참여자가 적어도 비디오 grid 비율 검증 가능.
 *
 * `animationSpeed`: 카드 비행 + EventOverlay + dealing stagger의 속도 배수.
 * 테스트 모드에서 이펙트 빠르게 검증 (16×) 또는 디테일 검토 (0.25×) 용.
 * INTER_PHASE_DELAY 포함 모든 sec() 적용 duration이 자동으로 배수 적용됨.
 */

const FILL_KEY = 'gostop:dev-video-fill-count';
const SPEED_KEY = 'gostop:dev-animation-speed';
const DEFAULT_FILL = import.meta.env.DEV ? 5 : 0;
const VALID_SPEEDS = [0.5, 1, 1.5, 2] as const;
type AnimationSpeed = (typeof VALID_SPEEDS)[number];
const DEFAULT_SPEED: AnimationSpeed = 1;

function loadFill(): number {
  try {
    const raw = localStorage.getItem(FILL_KEY);
    if (raw == null) return DEFAULT_FILL;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.min(5, n)) : DEFAULT_FILL;
  } catch {
    return DEFAULT_FILL;
  }
}

function loadSpeed(): AnimationSpeed {
  // production은 항상 DEFAULT_SPEED — localStorage 조작으로 속도 변경 차단
  if (!import.meta.env.DEV) return DEFAULT_SPEED;
  try {
    const raw = localStorage.getItem(SPEED_KEY);
    if (raw == null) return DEFAULT_SPEED;
    const n = Number(raw);
    return (VALID_SPEEDS.find((v) => v === n) ?? DEFAULT_SPEED) as AnimationSpeed;
  } catch {
    return DEFAULT_SPEED;
  }
}

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

interface DevTestState {
  /** 0~5: 화상채팅 placeholder 인원 수 (실제 참여자 위에 채움). 0이면 비활성. */
  videoFillCount: number;
  setVideoFillCount: (n: number) => void;
  /** 0.5 / 1 / 2 / 4 / 8 / 16 — 모든 애니메이션 속도 배수 */
  animationSpeed: AnimationSpeed;
  setAnimationSpeed: (s: AnimationSpeed) => void;
}

// 초기 multiplier 적용 — 페이지 로드 시점
const initialSpeed = loadSpeed();
setSpeedMultiplier(initialSpeed);

export const useDevTestStore = create<DevTestState>((set) => ({
  videoFillCount: loadFill(),
  setVideoFillCount: (n) => {
    const clamped = Math.max(0, Math.min(5, n));
    save(FILL_KEY, String(clamped));
    set({ videoFillCount: clamped });
  },
  animationSpeed: initialSpeed,
  setAnimationSpeed: (s) => {
    const valid = VALID_SPEEDS.find((v) => v === s) ?? DEFAULT_SPEED;
    save(SPEED_KEY, String(valid));
    setSpeedMultiplier(valid);
    set({ animationSpeed: valid });
  },
}));

export const ANIMATION_SPEED_OPTIONS = VALID_SPEEDS;
export type { AnimationSpeed };
