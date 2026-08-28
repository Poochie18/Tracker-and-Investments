/// <reference lib="webworker" />
// Кастомний Service Worker (injectManifest — див. vite.config.ts) замість
// стандартного generateSW: потрібен власний 'push'/'notificationclick'
// обробник для нагадувань про регулярні платежі (recurring-payments-cron
// Edge Function шле web-push, поки застосунок закритий).
declare const self: ServiceWorkerGlobalScope

import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkOnly } from 'workbox-strategies'

// Precache статики — той самий globPatterns, що був у workbox.generateSW
// раніше (vite-plugin-pwa підставляє список файлів у __WB_MANIFEST сам).
precacheAndRoute(self.__WB_MANIFEST)

// Supabase API — ніколи не кешуємо, завжди мережа (як і раніше).
registerRoute(({ url }) => /^https:\/\/.*\.supabase\.co\/.*/i.test(url.href), new NetworkOnly())

self.addEventListener('install', () => {
  void self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Нагадування про регулярний платіж — recurring-payments-cron шле
// { title, body } в JSON-тілі push-повідомлення.
self.addEventListener('push', (event) => {
  let payload: { title?: string; body?: string } = {}
  try {
    payload = event.data?.json() ?? {}
  } catch {
    // малоймовірний випадок не-JSON payload — показуємо нотифікацію
    // без деталей, а не падаємо мовчки
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Нагадування', {
      body: payload.body ?? '',
      icon: `${self.registration.scope}icons/icon-192.png`,
      badge: `${self.registration.scope}icons/icon-192.png`,
    })
  )
})

// Тап по нотифікації — відкриває застосунок (фокусує вже відкриту вкладку,
// якщо є, замість плодити нову).
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const scope = self.registration.scope

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.startsWith(scope))
      if (existing) return existing.focus()
      return self.clients.openWindow(scope)
    })
  )
})
