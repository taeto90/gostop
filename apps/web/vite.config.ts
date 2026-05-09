import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'assets/cards/*.svg'],
      manifest: {
        name: 'GoStop — 친구들과 즐기는 화투',
        short_name: 'GoStop',
        description: '한국 고스톱 + 5인 화상채팅',
        theme_color: '#0f5132',
        background_color: '#0a0e0c',
        display: 'standalone',
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
  ],
  server: {
    port: 5173,
    host: true,
  },
});
