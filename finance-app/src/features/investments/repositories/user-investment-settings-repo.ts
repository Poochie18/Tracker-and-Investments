import { db } from '@/lib/db'
import type { LocalUserInvestmentSettings } from '@/lib/db/schema'

// Репозиторій для роботи з user_investment_settings через Dexie (IndexedDB).
// Один рядок на користувача — "Вільні кошти" і ручне "Вкладено"
// акцій/крипти. Той самий патерн, що і accounts-repo: пишемо тільки
// локально, _sync_status='pending' підхоплює sync-engine.

function emptySettings(userId: string): LocalUserInvestmentSettings {
  const now = new Date().toISOString()
  return {
    id: userId,
    user_id: userId,
    free_cash_usd_minor: 0,
    stock_manual_invested_usd_minor: 0,
    crypto_manual_invested_usd_minor: 0,
    created_at: now,
    updated_at: now,
    _sync_status: 'pending',
    _sync_error: null,
    _local_updated_at: Date.now(),
  }
}

export const userInvestmentSettingsRepo = {
  // Рядок ще може не існувати (перший вхід користувача) — повертаємо
  // порожні нулі, не створюючи запис у Dexie: запис з'явиться лише коли
  // користувач щось реально збереже (update нижче робить upsert через put).
  async get(userId: string): Promise<LocalUserInvestmentSettings> {
    const existing = await db.userInvestmentSettings.get(userId)
    return existing ?? emptySettings(userId)
  },

  async update(
    userId: string,
    patch: Partial<
      Pick<
        LocalUserInvestmentSettings,
        'free_cash_usd_minor' | 'stock_manual_invested_usd_minor' | 'crypto_manual_invested_usd_minor'
      >
    >
  ): Promise<void> {
    const existing = await db.userInvestmentSettings.get(userId)
    const base = existing ?? emptySettings(userId)
    await db.userInvestmentSettings.put({
      ...base,
      ...patch,
      updated_at: new Date().toISOString(),
      _sync_status: 'pending',
      _local_updated_at: Date.now(),
    })
  },
}
