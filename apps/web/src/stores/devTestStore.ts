import { create } from 'zustand';

/**
 * 개발/테스트용 store. 운영 배포 시 영향 없음 (default 값이 dev 환경에서만 활성).
 *
 * `videoFillCount`: 화상채팅 사이드바/모바일 모달에 placeholder를 N개까지 채워
 * 실제 참여자가 적어도 비디오 grid 비율 검증 가능.
 */

const STORAGE_KEY = 'gostop:dev-video-fill-count';
const DEFAULT_FILL = import.meta.env.DEV ? 5 : 0;

function load(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return DEFAULT_FILL;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.min(5, n)) : DEFAULT_FILL;
  } catch {
    return DEFAULT_FILL;
  }
}

function save(n: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(n));
  } catch {
    /* ignore */
  }
}

interface DevTestState {
  /** 0~5: 화상채팅 placeholder 인원 수 (실제 참여자 위에 채움). 0이면 비활성. */
  videoFillCount: number;
  setVideoFillCount: (n: number) => void;
}

export const useDevTestStore = create<DevTestState>((set) => ({
  videoFillCount: load(),
  setVideoFillCount: (n) => {
    const clamped = Math.max(0, Math.min(5, n));
    save(clamped);
    set({ videoFillCount: clamped });
  },
}));
