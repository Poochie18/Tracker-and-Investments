import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import type { LocalAccount } from '@/lib/db/schema'

// Репозиторій для роботи з рахунками через Dexie (IndexedDB).
// Компоненти звертаються тільки сюди — не до db напряму.

export const accountsRepo = {
  // Усі рахунки користувача (включно з архівом), для екрану керування
  async getAll(userId: string): Promise<LocalAccount[]> {
    const accounts = await db.accounts.where('user_id').equals(userId).toArray()
    return accounts.sort((a, b) => a.created_at.localeCompare(b.created_at))
  },

  // Тільки активні — для вибору рахунку в транзакціях і перемикача на Огляді
  async getActive(userId: string): Promise<LocalAccount[]> {
    const accounts = await db.accounts
      .where('user_id')
      .equals(userId)
      .filter((a) => !a.is_archived)
      .toArray()
    return accounts.sort((a, b) => a.created_at.localeCompare(b.created_at))
  },

  async create(
    userId: string,
    data: { name: string; currency?: string }
  ): Promise<LocalAccount> {
    const now = new Date().toISOString()
    const account: LocalAccount = {
      id: uuidv4(),
      user_id: userId,
      name: data.name,
      currency: data.currency ?? 'UAH',
      is_archived: false,
      created_at: now,
      updated_at: now,
      _sync_status: 'pending',
      _sync_error: null,
      _local_updated_at: Date.now(),
    }

    await db.accounts.add(account)
    return account
  },

  async rename(id: string, name: string): Promise<void> {
    await db.accounts.update(id, {
      name,
      updated_at: new Date().toISOString(),
      _sync_status: 'pending',
      _local_updated_at: Date.now(),
    })
  },

  // Не даємо архівувати останній активний рахунок — інакше нові
  // транзакції не матимуть куди зберігатись.
  async archive(userId: string, id: string): Promise<void> {
    const active = await this.getActive(userId)
    if (active.length <= 1 && active.some((a) => a.id === id)) {
      throw new Error('Має лишитись хоча б один активний рахунок')
    }

    await db.accounts.update(id, {
      is_archived: true,
      updated_at: new Date().toISOString(),
      _sync_status: 'pending',
      _local_updated_at: Date.now(),
    })
  },

  async restore(id: string): Promise<void> {
    await db.accounts.update(id, {
      is_archived: false,
      updated_at: new Date().toISOString(),
      _sync_status: 'pending',
      _local_updated_at: Date.now(),
    })
  },
}
