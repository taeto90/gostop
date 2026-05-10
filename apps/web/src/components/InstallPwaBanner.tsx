import { useEffect, useState } from 'react';
import { isMobileTouch, isPwaMode } from '../lib/pwa.ts';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'gostop:pwa-banner-dismissed';

/**
 * 모바일 사용자에게 PWA 설치 안내 배너.
 *
 * - 데스크톱 또는 이미 PWA 모드면 표시 X
 * - localStorage flag로 dismiss 영속
 * - Chrome/Edge: beforeinstallprompt 이벤트로 native 설치 dialog
 * - iOS Safari: 안내 텍스트 (공유 → 홈 화면에 추가)
 */
export function InstallPwaBanner() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isPwaMode() || !isMobileTouch()) return;
    if (localStorage.getItem(DISMISSED_KEY) === '1') return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // Chrome 외 브라우저(iOS Safari 등) — 이벤트 안 와도 안내만 띄움
    const t = setTimeout(() => setShow(true), 2000);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      clearTimeout(t);
    };
  }, []);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setShow(false);
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
    } else {
      dismiss();
    }
  }

  return (
    <div className="fixed bottom-3 left-3 right-3 z-50 rounded-xl border-2 border-amber-400/60 bg-felt-900/95 p-3 shadow-2xl backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-amber-200">📲 앱으로 설치</div>
          <p className="mt-1 text-[11px] text-felt-300">
            홈 화면에 추가하면 주소창 없이 가로 모드 풀스크린으로 즐길 수 있습니다.
            {!event && (
              <span className="mt-1 block text-[10px] text-felt-400">
                iOS: 공유 → 홈 화면에 추가 / Android Chrome: ⋮ → 앱 설치
              </span>
            )}
          </p>
        </div>
        <button
          onClick={dismiss}
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-felt-400 hover:bg-felt-800"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>
      {event && (
        <button
          onClick={install}
          className="mt-2 w-full rounded-md bg-amber-500 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400"
        >
          설치하기
        </button>
      )}
    </div>
  );
}
