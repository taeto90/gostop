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
    // DIY OTA (Capgo Cloud 미사용) — autoUpdate:false 수동 모드.
    // 앱 시작 시 lib/otaUpdate.ts 가 Supabase Storage의 latest.json 확인 →
    // 더 새 번들이면 download+set (다음 실행 시 적용). 업로드는 `pnpm ota:diy`.
    CapacitorUpdater: {
      autoUpdate: false,
    },
  },
};

export default config;
