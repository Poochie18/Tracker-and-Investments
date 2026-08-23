import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import type { LocalBondCouponDate } from '@/lib/db/schema'

// Репозиторій дат виплат купонів облігації. На відміну від поповнень
// депозиту (фіксовані слоти по місяцях), це довільний список дат, тому
// редагування завжди замінює весь список цілком — простіше й надійніше,
// ніж diff доданих/видалених дат.

export const bondCouponDatesRepo = {
  async getForInvestment(investmentId: string): Promise<LocalBondCouponDate[]> {
    return db.bondCouponDates
      .where('investment_id')
      .equals(investmentId)
      .filter((d) => d.deleted_at === null)
      .sortBy('payment_date')
  },

  // Всі дати користувача одразу (по всіх облігаціях) — для зведень.
  async getAllForUser(userId: string): Promise<LocalBondCouponDate[]> {
    return db.bondCouponDates
      .where('user_id')
      .equals(userId)
      .filter((d) => d.deleted_at === null)
      .sortBy('payment_date')
  },

  // Повністю замінює список дат для облігації: старі — soft delete
  // (щоб видалення дійшло до Supabase), нові — створює.
  async replaceAll(userId: string, investmentId: string, dates: string[]): Promise<void> {
    const now = new Date().toISOString()
    const existing = await db.bondCouponDates
      .where('investment_id')
      .equals(investmentId)
      .filter((d) => d.deleted_at === null)
      .toArray()

    await db.bondCouponDates.bulkPut(
      existing.map((d) => ({
        ...d,
        deleted_at: now,
        updated_at: now,
        _sync_status: 'pending' as const,
        _local_updated_at: Date.now(),
      }))
    )

    const fresh: LocalBondCouponDate[] = dates.map((paymentDate) => ({
      id: uuidv4(),
      user_id: userId,
      investment_id: investmentId,
      payment_date: paymentDate,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      _sync_status: 'pending',
      _sync_error: null,
      _local_updated_at: Date.now(),
    }))

    if (fresh.length > 0) {
      await db.bondCouponDates.bulkAdd(fresh)
    }
  },
}
