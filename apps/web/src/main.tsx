import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
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
