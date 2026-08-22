import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import type { LocalDepositContribution } from '@/lib/db/schema'

// Репозиторій помісячних поповнень депозиту через Dexie.
// Один запис на (investment_id, month_index) — upsert замінює
// існуюче поповнення за той самий місяць, а не додає дублікат.

export const depositContributionsRepo = {
  async getByInvestment(investmentId: string): Promise<LocalDepositContribution[]> {
    return db.depositContributions
      .where('investment_id')
      .equals(investmentId)
      .filter((c) => c.deleted_at === null)
      .sortBy('month_index')
  },

  // Створює або оновлює поповнення за конкретний місяць
  async upsertMonth(
    userId: string,
    investmentId: string,
    monthIndex: number,
    amountUnits: number // у валюті активу, не копійки
  ): Promise<LocalDepositContribution> {
    const existing = await db.depositContributions
      .where('[investment_id+month_index]')
      .equals([investmentId, monthIndex])
      .first()

    const now = new Date().toISOString()
    const amount = Math.round(amountUnits * 100)

    if (existing) {
      const updated: LocalDepositContribution = {
        ...existing,
        amount,
        updated_at: now,
        deleted_at: null,
        _sync_status: 'pending',
        _local_updated_at: Date.now(),
      }
      await db.depositContributions.put(updated)
      return updated
    }

    const created: LocalDepositContribution = {
      id: uuidv4(),
      user_id: userId,
      investment_id: investmentId,
      month_index: monthIndex,
      amount,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      _sync_status: 'pending',
      _sync_error: null,
      _local_updated_at: Date.now(),
    }
    await db.depositContributions.add(created)
    return created
  },

  // Масове збереження (використовується при синхронізації)
  async upsertMany(contributions: LocalDepositContribution[]): Promise<void> {
    await db.depositContributions.bulkPut(contributions)
  },
}
