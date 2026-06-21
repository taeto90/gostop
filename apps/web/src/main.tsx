import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App.tsx';
import './styles/index.css';

// 진단용 — unhandled promise rejection 잡아서 정확한 stack trace 출력 (추후 제거)
window.addEventListener('unhandledrejection', (e) => {
  console.error('[DIAG unhandledrejection]', e.reason);
  console.error('[DIAG stack]', (e.reason as Error)?.stack);
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Capgo OTA — 앱(Capacitor)에서 새 번들이 정상 로드됐음을 알림.
// 호출 안 하면 업데이트 후 일정 시간 뒤 이전 번들로 자동 롤백됨 (안전장치).
if (Capacitor.isNativePlatform()) {
  void import('@capgo/capacitor-updater').then(({ CapacitorUpdater }) => {
    void CapacitorUpdater.notifyAppReady();
  });
}
