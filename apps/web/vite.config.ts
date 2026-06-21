import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Capacitor(Android 앱) 빌드: `vite build --mode capacitor`
//   - service worker 비활성 (네이티브 WebView가 에셋을 직접 서빙 → SW 캐시 충돌/stale 방지)
//   - .env.capacitor 가 .env 위에 병합되어 VITE_SERVER_URL=Railway 사용
// 웹 배포(Vercel) 빌드는 mode=production → PWA 유지 + .env.production.
export default defineConfig(({ mode }) => {
  const isCapacitor = mode === 'capacitor';

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(isCapacitor
        ? []
        : [
            VitePWA({
              registerType: 'autoUpdate',
              // dev 환경에서는 SW 등록 X — stale cache + JSON 파싱 에러 회피
              devOptions: { enabled: false },
              includeAssets: ['favicon.svg', 'assets/cards/*.svg'],
              manifest: {
                name: 'GoStop — 친구들과 즐기는 화투',
                short_name: 'GoStop',
                description: '한국 고스톱 + 5인 화상채팅',
                theme_color: '#0f5132',
                background_color: '#0a0e0c',
                display: 'fullscreen',
                display_override: ['fullscreen', 'standalone'],
                orientation: 'landscape',
                lang: 'ko',
                start_url: '/',
                icons: [
                  {
                    src: '/icon.svg',
                    sizes: 'any',
                    type: 'image/svg+xml',
                    purpose: 'any maskable',
                  },
                ],
              },
              workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
                runtimeCaching: [
                  {
                    urlPattern: /^https?:\/\/.*\.(svg|png|jpg|jpeg)$/,
                    handler: 'CacheFirst',
                    options: {
                      cacheName: 'card-assets',
                      expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
                    },
                  },
                ],
              },
            }),
          ]),
    ],
    server: {
      port: 5173,
      host: true,
    },
  };
});
