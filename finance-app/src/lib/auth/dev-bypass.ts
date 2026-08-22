import type { User } from '@supabase/supabase-js'

// ============================================================
// Офлайн dev-режим — повністю обходить Supabase (auth + sync),
// щоб можна було розробляти й тестувати UI, коли Supabase
// недоступний (проєкт призупинено, немає інтернету тощо).
// Працює лише в dev-збірці (import.meta.env.DEV) — у production
// білді isDevOfflineMode() завжди повертає false.
//
// Вмикається кнопкою на LoginScreen, стан лежить у localStorage,
// щоб переживати перезавантаження сторінки.
//
// TODO: прибрати разом із тестовим email/password логіном,
// коли Google OAuth запрацює локально.
// ============================================================

const STORAGE_KEY = 'dev_offline_mode'

// Фіксований UUID — щоб дані в Dexie не губились між сесіями/перезавантаженнями.
export const DEV_USER_ID = '00000000-0000-4000-8000-000000000001'

export const DEV_USER = { id: DEV_USER_ID, email: 'dev@local.test' } as User

export function isDevOfflineMode(): boolean {
  return import.meta.env.DEV && localStorage.getItem(STORAGE_KEY) === 'true'
}

export function enableDevOfflineMode(): void {
  localStorage.setItem(STORAGE_KEY, 'true')
}

export function disableDevOfflineMode(): void {
  localStorage.removeItem(STORAGE_KEY)
}
