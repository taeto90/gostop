import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { useRoomSocket } from './hooks/useRoomSocket.ts';
import { useSessionStore } from './stores/sessionStore.ts';
import { useAuthStore, initAuth } from './stores/authStore.ts';
import { useGameHistoryStore } from './stores/gameHistoryStore.ts';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { EventOverlay } from './components/EventOverlay.tsx';
import { NativeBackButtonGuard } from './components/NativeBackButtonGuard.tsx';
import { InstallPwaBanner } from './components/InstallPwaBanner.tsx';
import { ToastContainer } from './components/ToastContainer.tsx';
import { tryLockLandscape } from './lib/pwa.ts';
import { connectSocket, updateSocketToken, disconnectSocket } from './lib/socket.ts';
import { LoginPage } from './features/auth/LoginPage.tsx';
import { ProfileSetupPage } from './features/auth/ProfileSetupPage.tsx';
import { GameDemoView } from './features/debug-game/GameDemoView.tsx';
import { Lobby } from './features/lobby/Lobby.tsx';
import { ResultDemoView } from './features/room/ResultDemoView.tsx';
import { RoomScreen } from './features/room/RoomScreen.tsx';
import { RuleTestPage } from './features/rule-test/RuleTestPage.tsx';
import { AdminPage } from './features/admin/AdminPage.tsx';

// 앱 로드 시 1회 — Supabase 세션 복원
initAuth();

export default function App() {
  const initialized = useAuthStore((s) => s.initialized);
  const user = useAuthStore((s) => s.user);
  const session = useAuthStore((s) => s.session);
  const dbProfile = useAuthStore((s) => s.dbProfile);
  const profile = useSessionStore((s) => s.profile);

  // dbProfile이 로드되면 sessionStore에 동기화
  useEffect(() => {
    if (user && dbProfile) {
      useSessionStore.getState().setProfile({
        userId: user.id,
        nickname: dbProfile.nickname,
        emojiAvatar: dbProfile.emoji_avatar,
      });
    } else if (!user) {
      useSessionStore.getState().clearProfile();
      disconnectSocket();
    }
  }, [user, dbProfile]);

  // 토큰 갱신은 세션 변화 즉시 (재연결 시 최신 토큰 사용)
  useEffect(() => {
    if (session?.access_token) updateSocketToken(session.access_token);
  }, [session?.access_token]);

  // 소켓 연결은 프로필 준비 후
  useEffect(() => {
    if (session?.access_token && dbProfile) connectSocket();
  }, [session?.access_token, dbProfile]);

  useRoomSocket();

  const myUserId = useSessionStore((s) => s.profile?.userId);
  useEffect(() => {
    if (!myUserId) return;
    void useGameHistoryStore.getState().syncFromCloud(myUserId);
  }, [myUserId]);

  useEffect(() => {
    void tryLockLandscape();
  }, []);

  // 개발용 — 인증 없이 게임 UI 데모 (/game-demo, playwright 캡처용). DEV 전용.
  if (import.meta.env.DEV && window.location.pathname === '/game-demo') {
    return (
      <ErrorBoundary>
        <GameDemoView />
        <EventOverlay />
        <ToastContainer />
      </ErrorBoundary>
    );
  }

  // 초기 세션 복원 중 — 로딩 화면
  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-950 via-green-900 to-emerald-950">
        <div className="text-center">
          <div className="mb-4 text-5xl">🎴</div>
          <p className="text-green-200">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 미인증 → 로그인 페이지
  if (!user) {
    return (
      <ErrorBoundary>
        <LoginPage />
        <ToastContainer />
      </ErrorBoundary>
    );
  }

  // 프로필 미설정 (첫 로그인) → 프로필 설정 페이지
  if (!profile) {
    return (
      <ErrorBoundary>
        <ProfileSetupPage />
        <ToastContainer />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/room/:id" element={<RoomScreen />} />
          <Route path="/result-demo" element={<ResultDemoView />} />
          <Route path="/rule-test" element={<RuleTestPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
        <EventOverlay />
        <ToastContainer />
        <InstallPwaBanner />
        <NativeBackButtonGuard />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
