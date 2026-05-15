import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import type { LocalTransaction, TransactionType } from '@/lib/db/schema'
import type { TransactionFilter } from '../types'

// Репозиторій для роботи з транзакціями через Dexie.
// Всі зміни відразу позначаються як _sync_status='pending'.

export const transactionsRepo = {
  // Отримати транзакції за фільтром (без видалених)
  async getByFilter(filter: TransactionFilter): Promise<LocalTransaction[]> {
    const from = filter.dateFrom.toISOString()
    const to = filter.dateTo.toISOString()

    let collection = db.transactions
      .where('user_id')
      .equals(filter.userId)
      .filter(
        (t) =>
          t.deleted_at === null &&
          t.date >= from &&
          t.date <= to &&
          (filter.type === undefined || t.type === filter.type) &&
          (filter.categoryId === undefined || t.category_id === filter.categoryId)
      )

    // Сортуємо по даті — нові першими
    const results = await collection.toArray()
    return results.sort((a, b) => b.date.localeCompare(a.date))
  },

  async getById(id: string): Promise<LocalTransaction | undefined> {
    return db.transactions.get(id)
  },

  // Створити транзакцію (Write path: спочатку локально, потім синк)
  async create(
    userId: string,
    data: {
      account_id: string
      category_id: string
      type: TransactionType
      amount: number  // у копійках!
      currency?: string
      date: Date
      comment?: string
    }
  ): Promise<LocalTransaction> {
    const now = new Date().toISOString()
    const transaction: LocalTransaction = {
      id: uuidv4(),
      user_id: userId,
      account_id: data.account_id,
      category_id: data.category_id,
      type: data.type,
      amount: data.amount,
      currency: data.currency ?? 'UAH',
      date: data.date.toISOString(),
      comment: data.comment ?? null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      _sync_status: 'pending',
      _sync_error: null,
      _local_updated_at: Date.now(),
    }

    await db.transactions.add(transaction)
    return transaction
  },

  async update(
    id: string,
    data: Partial<Pick<LocalTransaction, 'category_id' | 'amount' | 'date' | 'comment' | 'type'>>
  ): Promise<void> {
    await db.transactions.update(id, {
      ...data,
      updated_at: new Date().toISOString(),
      _sync_status: 'pending',
      _local_updated_at: Date.now(),
    })
  },

  // Soft delete — ставимо deleted_at замість реального видалення.
  // Так інші пристрої при синку дізнаються що запис видалено.
  async softDelete(id: string): Promise<void> {
    await db.transactions.update(id, {
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _sync_status: 'pending',
      _local_updated_at: Date.now(),
    })
  },

  // Рахуємо загальну суму по типу і фільтру
  async sumByType(
    filter: TransactionFilter,
    type: TransactionType
  ): Promise<number> {
    const transactions = await this.getByFilter({ ...filter, type })
    return transactions.reduce((sum, t) => sum + t.amount, 0)
  },

  // Масове збереження (використовується при початковому синку з Supabase)
  async upsertMany(transactions: LocalTransaction[]): Promise<void> {
    await db.transactions.bulkPut(transactions)
  },

  // Всі pending записи — для sync engine (Фаза 5)
  async getPending(userId: string): Promise<LocalTransaction[]> {
    return db.transactions
      .where('user_id')
      .equals(userId)
      .filter((t) => t._sync_status === 'pending')
      .toArray()
  },
}
