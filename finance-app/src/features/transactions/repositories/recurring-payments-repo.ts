import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import type { LocalRecurringPayment, RecurringFrequency, TransactionType } from '@/lib/db/schema'

// Репозиторій регулярних платежів — шаблонів, з яких автоматично
// генеруються звичайні транзакції (generateDueRecurringTransactions
// в use-recurring-payments.ts). Сам паттерн — як transactions-repo.ts.

export const recurringPaymentsRepo = {
  // Всі активні (не видалені) регулярні платежі користувача, і призупинені
  // теж — фільтр на активність робить UI (список показує обидва стани).
  async getAll(userId: string): Promise<LocalRecurringPayment[]> {
    return db.recurringPayments
      .where('user_id')
      .equals(userId)
      .filter((r) => r.deleted_at === null)
      .toArray()
  },

  async getById(id: string): Promise<LocalRecurringPayment | undefined> {
    return db.recurringPayments.get(id)
  },

  async create(
    userId: string,
    data: {
      name: string
      type: TransactionType
      amount: number  // у копійках!
      currency?: string
      category_id: string
      account_id: string
      comment?: string
      frequency: RecurringFrequency
      start_date: string  // ISO 8601 (дата)
      start_time: string  // 'HH:MM'
      end_date?: string | null
    }
  ): Promise<LocalRecurringPayment> {
    const now = new Date().toISOString()
    const recurring: LocalRecurringPayment = {
      id: uuidv4(),
      user_id: userId,
      name: data.name,
      type: data.type,
      amount: data.amount,
      currency: data.currency ?? 'UAH',
      category_id: data.category_id,
      account_id: data.account_id,
      comment: data.comment ?? null,
      frequency: data.frequency,
      start_date: data.start_date,
      start_time: data.start_time,
      end_date: data.end_date ?? null,
      is_active: true,
      last_generated_date: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      _sync_status: 'pending',
      _sync_error: null,
      _local_updated_at: Date.now(),
    }

    await db.recurringPayments.add(recurring)
    return recurring
  },

  async update(
    id: string,
    data: Partial<
      Pick<
        LocalRecurringPayment,
        'name' | 'type' | 'amount' | 'category_id' | 'account_id' | 'comment' | 'frequency' | 'start_date' | 'start_time' | 'end_date'
      >
    >
  ): Promise<void> {
    await db.recurringPayments.update(id, {
      ...data,
      updated_at: new Date().toISOString(),
      _sync_status: 'pending',
      _local_updated_at: Date.now(),
    })
  },

  // Увімкнути/призупинити без видалення — саме так платіж можна "виключити".
  async setActive(id: string, isActive: boolean): Promise<void> {
    await db.recurringPayments.update(id, {
      is_active: isActive,
      updated_at: new Date().toISOString(),
      _sync_status: 'pending',
      _local_updated_at: Date.now(),
    })
  },

  // Викликається генерацією (client і pull з сервера) після створення
  // чергової транзакції — зсуває позначку, щоб не згенерувати той самий
  // випадок вдруге.
  async markGenerated(id: string, lastGeneratedDate: string): Promise<void> {
    await db.recurringPayments.update(id, {
      last_generated_date: lastGeneratedDate,
      updated_at: new Date().toISOString(),
      _sync_status: 'pending',
      _local_updated_at: Date.now(),
    })
  },

  async softDelete(id: string): Promise<void> {
    await db.recurringPayments.update(id, {
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _sync_status: 'pending',
      _local_updated_at: Date.now(),
    })
  },

  async upsertMany(recurring: LocalRecurringPayment[]): Promise<void> {
    await db.recurringPayments.bulkPut(recurring)
  },

  async getPending(userId: string): Promise<LocalRecurringPayment[]> {
    return db.recurringPayments
      .where('user_id')
      .equals(userId)
      .filter((r) => r._sync_status === 'pending')
      .toArray()
  },
}
