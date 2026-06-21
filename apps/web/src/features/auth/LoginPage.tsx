import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../../lib/supabase.ts';
import { toast } from '../../stores/toastStore.ts';

/** 앱(Capacitor)에서 OAuth 리다이렉트를 받을 custom scheme deep-link. Supabase Redirect URLs에 등록됨. */
const APP_OAUTH_REDIRECT = 'com.gostop.app://login-callback';

export function LoginPage() {
  const [busy, setBusy] = useState(false);

  async function handleGoogleLogin() {
    if (!supabase) {
      toast.error('Supabase가 설정되지 않았습니다');
      return;
    }
    setBusy(true);

    // 앱: 시스템 브라우저로 OAuth → deep-link 콜백(authStore appUrlOpen)이 세션 처리
    if (Capacitor.isNativePlatform()) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: APP_OAUTH_REDIRECT, skipBrowserRedirect: true },
      });
      if (error || !data?.url) {
        toast.error(error?.message ?? 'OAuth URL 생성 실패');
        setBusy(false);
        return;
      }
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: data.url });
      // 세션 수립은 deep-link 콜백에서 → busy는 화면 전환으로 자연 해제
      return;
    }

    // 웹: 현재 origin으로 리다이렉트 (기존 흐름)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      toast.error(error.message);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-950 via-green-900 to-emerald-950 p-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div>
          <h1 className="text-5xl font-bold text-amber-400">
            🎴 화투 게임
          </h1>
          <p className="mt-3 text-sm text-green-200">
            친구들과 즐기는 전통 카드 게임
          </p>
        </div>

        <div className="rounded-2xl border border-amber-700/40 bg-green-900/50 p-8 backdrop-blur-sm">
          <h2 className="mb-6 text-lg font-bold text-white">로그인</h2>

          <button
            onClick={handleGoogleLogin}
            disabled={busy}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-600 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google로 로그인
          </button>
        </div>

        <p className="text-xs text-green-400/60">
          로그인 시 서비스 이용에 동의하는 것으로 간주합니다
        </p>
      </div>
    </div>
  );
}
