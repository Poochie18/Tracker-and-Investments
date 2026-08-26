import { v4 as uuidv4 } from 'uuid'
import { isDevOfflineMode } from './dev-bypass'

// ============================================================
// Гостьовий режим і перемикач "локально/хмара" для авторизованих
// користувачів — обидва варіанти означають "не звертатись до
// Supabase для цього userId", тож зведені в одну точку правди
// (isLocalOnly), якою користуються sync-engine і first-login-setup.
// ============================================================

const GUEST_ID_KEY = 'guest_user_id'
const GUEST_MODE_KEY = 'guest_mode_enabled'
const PENDING_MIGRATION_KEY = 'pending_guest_migration_id'
const storageModeKey = (userId: string) => `storage_mode_${userId}`

// Гостьовий ідентифікатор — генерується один раз на пристрій і
// зберігається в localStorage, щоб дані в Dexie не губились між сесіями.
export function getOrCreateGuestId(): string {
  let id = localStorage.getItem(GUEST_ID_KEY)
  if (!id) {
    id = uuidv4()
    localStorage.setItem(GUEST_ID_KEY, id)
  }
  return id
}

export function isGuestMode(): boolean {
  return localStorage.getItem(GUEST_MODE_KEY) === 'true'
}

export function enableGuestMode(): void {
  localStorage.setItem(GUEST_MODE_KEY, 'true')
}

// Викликається після успішної міграції гостьових даних у реальний акаунт
// (або якщо гість просто хоче почати заново без реєстрації).
export function disableGuestMode(): void {
  localStorage.removeItem(GUEST_MODE_KEY)
}

// Ставиться перед редіректом на Google OAuth, щоб AuthGuard після
// повернення знав, що треба перенести гостьові дані на реальний акаунт.
export function markPendingGuestMigration(): void {
  localStorage.setItem(PENDING_MIGRATION_KEY, getOrCreateGuestId())
}

export function getPendingGuestMigrationId(): string | null {
  return localStorage.getItem(PENDING_MIGRATION_KEY)
}

export function clearPendingGuestMigration(): void {
  localStorage.removeItem(PENDING_MIGRATION_KEY)
}

// ── Перемикач "локально/хмара" для вже авторизованих користувачів ──

export type StorageMode = 'cloud' | 'local'

export function getStorageMode(userId: string): StorageMode {
  return localStorage.getItem(storageModeKey(userId)) === 'local' ? 'local' : 'cloud'
}

export function setStorageMode(userId: string, mode: StorageMode): void {
  localStorage.setItem(storageModeKey(userId), mode)
}

// Єдина точка правди: чи треба уникати звернень до Supabase для цього userId.
// Охоплює три випадки: dev офлайн-режим, гість, і авторизований користувач
// зі світчем "Зберігати локально" вимкненим.
export function isLocalOnly(userId: string): boolean {
  if (isDevOfflineMode()) return true
  if (isGuestMode() && userId === getOrCreateGuestId()) return true
  return getStorageMode(userId) === 'local'
}
