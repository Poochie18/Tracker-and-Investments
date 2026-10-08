import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import type { LocalSavings } from '@/lib/db/schema'

// Репозиторій "гаманців" готівкових заощаджень (вкладка "Збереження") —
// той самий патерн, що і recurring-payments-repo.ts.

export const savingsRepo = {
  async getAll(userId: string): Promise<LocalSavings[]> {
    return db.savings
      .where('user_id')
      .equals(userId)
      .filter((s) => s.deleted_at === null)
      .toArray()
  },

  async getById(id: string): Promise<LocalSavings | undefined> {
    return db.savings.get(id)
  },

  async create(
    userId: string,
    data: { name: string; amount_uah: number; amount_usd: number; amount_eur: number }
  ): Promise<LocalSavings> {
    const now = new Date().toISOString()
    const savings: LocalSavings = {
      id: uuidv4(),
      user_id: userId,
      name: data.name,
      amount_uah: data.amount_uah,
      amount_usd: data.amount_usd,
      amount_eur: data.amount_eur,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      _sync_status: 'pending',
      _sync_error: null,
      _local_updated_at: Date.now(),
    }

    await db.savings.add(savings)
    return savings
  },

  async update(
    id: string,
    data: Partial<Pick<LocalSavings, 'name' | 'amount_uah' | 'amount_usd' | 'amount_eur'>>
  ): Promise<void> {
    await db.savings.update(id, {
      ...data,
      updated_at: new Date().toISOString(),
      _sync_status: 'pending',
      _local_updated_at: Date.now(),
    })
  },

  async softDelete(id: string): Promise<void> {
    await db.savings.update(id, {
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _sync_status: 'pending',
      _local_updated_at: Date.now(),
    })
  },

  async upsertMany(savings: LocalSavings[]): Promise<void> {
    await db.savings.bulkPut(savings)
  },

  async getPending(userId: string): Promise<LocalSavings[]> {
    return db.savings
      .where('user_id')
      .equals(userId)
      .filter((s) => s._sync_status === 'pending')
      .toArray()
  },
}
