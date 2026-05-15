import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Включаємо dev-режим для Service Worker під час розробки
      devOptions: { enabled: true },
      manifest: {
        name: 'Мої фінанси',
        short_name: 'Фінанси',
        description: 'Особистий облік доходів і витрат',
        theme_color: '#1B2A2A',
        background_color: '#1B2A2A',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache: HTML, JS, CSS — Cache First
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Supabase API — тільки мережа, не кешуємо
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
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
