/**
 * PWA 환경 감지 + 가로 orientation lock 시도.
 *
 * - standalone/fullscreen 모드 (홈 화면에서 실행)인지 detect
 * - 가로 lock은 Screen Orientation API 필요 — 일반 브라우저는 권한 X (PWA fullscreen만 가능)
 * - lock 실패는 silent (브라우저 호환성 다양)
 */

export function isPwaMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    // iOS Safari standalone
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

/** 모바일(touch) 환경 추정 — 좁은 viewport + touch 지원 */
export function isMobileTouch(): boolean {
  if (typeof window === 'undefined') return false;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isNarrow = window.innerWidth < 950;
  return isTouch && isNarrow;
}

/**
 * 가로 모드 lock 시도. PWA fullscreen에서만 실제로 동작.
 * 일반 브라우저는 보안 정책상 사용자 액션 없이는 lock 못 함 — 조용히 실패.
 */
export async function tryLockLandscape(): Promise<void> {
  if (!isPwaMode()) return;
  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: 'landscape' | 'portrait') => Promise<void>;
    };
    if (orientation.lock) {
      await orientation.lock('landscape');
    }
  } catch {
    /* lock 실패 — 권한 없거나 미지원 브라우저. 그대로 진행 */
  }
}
