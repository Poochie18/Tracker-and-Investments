// Таймстемпи останнього автосинку цін акцій/крипти — окремо для кожного
// типу і користувача (localStorage, не Dexie: суто UI-таймер, не дані,
// які треба синхронізувати між пристроями).

export const AUTO_PRICE_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 годин

export type PriceSyncKind = 'stock' | 'crypto'

function storageKey(userId: string, kind: PriceSyncKind): string {
  return `price_sync_last_${kind}_${userId}`
}

export function getLastPriceSync(userId: string, kind: PriceSyncKind): number | null {
  const raw = localStorage.getItem(storageKey(userId, kind))
  return raw ? Number(raw) : null
}

export function setLastPriceSync(userId: string, kind: PriceSyncKind, timestamp: number): void {
  localStorage.setItem(storageKey(userId, kind), String(timestamp))
}

// null (ще не синкали жодного разу) теж вважаємо "час настав" — щоб
// перший автосинк відбувся одразу, а не через 6 годин після реєстрації.
export function isPriceSyncDue(userId: string, kind: PriceSyncKind): boolean {
  const last = getLastPriceSync(userId, kind)
  return last === null || Date.now() - last >= AUTO_PRICE_SYNC_INTERVAL_MS
}
