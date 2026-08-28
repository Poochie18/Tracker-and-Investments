import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// На GitHub Pages додаток живе не в корені домену, а в /Tracker-and-Investments/ —
// base застосовується і до Vite-збірки, і до маніфесту/service worker нижче.
const base = '/Tracker-and-Investments/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // injectManifest (не generateSW) — потрібен власний src/sw.ts з
      // 'push'/'notificationclick' обробниками для нагадувань про
      // регулярні платежі (recurring-payments-cron шле web-push, поки
      // застосунок закритий). precache статики й далі підставляється
      // автоматично (self.__WB_MANIFEST в sw.ts).
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      // Включаємо dev-режим для Service Worker під час розробки
      devOptions: { enabled: true, type: 'module' },
      manifest: {
        name: 'Мої фінанси',
        short_name: 'Фінанси',
        description: 'Особистий облік доходів і витрат',
        theme_color: '#1B2A2A',
        background_color: '#1B2A2A',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
          {
            src: `${base}icons/icon-512-maskable.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    // Аліас @ → src/, щоб не писати ../../.. у імпортах
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
