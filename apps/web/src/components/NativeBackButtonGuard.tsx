import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

/**
 * Android 뒤로가기 버튼 처리 (Capacitor 앱 전용 — 웹에서는 no-op).
 *
 * - 웹 히스토리가 있으면 뒤로 이동 (방 → 로비 등 자연스러운 네비게이션)
 * - 더 갈 곳이 없는 루트(로비/로그인)에서 누르면 "게임 종료" 확인 모달 표시
 *   → [종료] 시 exitApp, [취소] 시 그대로 유지
 *
 * backButton 리스너를 등록하면 Capacitor 기본 동작(즉시 종료/히스토리 백)을
 * 대체하므로, 여기서 직접 분기 처리한다.
 */
export function NativeBackButtonGuard() {
  const [showExit, setShowExit] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => void } | undefined;
    void CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        setShowExit(true);
      }
    }).then((h) => {
      handle = h;
    });
    return () => {
      handle?.remove();
    };
  }, []);

  if (!showExit) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <div className="w-full max-w-xs rounded-2xl border-2 border-amber-400/60 bg-gradient-to-b from-felt-800 to-felt-950 p-6 text-center shadow-2xl">
        <div className="mb-1 text-4xl">🎴</div>
        <div className="mb-5 text-lg font-bold text-felt-50">게임을 종료하시겠습니까?</div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowExit(false)}
            className="rounded-lg bg-felt-700 px-4 py-3 font-bold text-felt-100 hover:bg-felt-600"
          >
            취소
          </button>
          <button
            onClick={() => void CapApp.exitApp()}
            className="rounded-lg bg-rose-600 px-4 py-3 font-bold text-white hover:bg-rose-500"
          >
            종료
          </button>
        </div>
      </div>
    </div>
  );
}
