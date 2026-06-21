import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gostop.app',
  appName: '고스톱',
  // Vite 빌드 산출물 (apps/web/dist). `npx cap sync`가 이 폴더를 네이티브로 복사.
  webDir: 'dist',
  server: {
    // Android WebView origin = https://localhost (Capacitor 6+ 기본).
    // 서버 CORS_ORIGIN에 이 origin을 허용해야 소켓/LiveKit 토큰 요청이 통과됨.
    androidScheme: 'https',
  },
  plugins: {
    // Capgo OTA — 웹 에셋(HTML/JS/CSS) 변경을 앱 재설치 없이 자동 업데이트.
    // 업로드는 @capgo/cli (API 키는 CLI 인증으로만 사용, 여기엔 넣지 않음).
    CapacitorUpdater: {
      autoUpdate: true,
    },
  },
};

export default config;
