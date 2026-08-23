import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import type { LocalPortfolioSnapshot, PortfolioSnapshotRow } from '@/lib/db/schema'

export interface SavePortfolioSnapshotInput {
  fiscalYearKey: string
  fiscalYearLabel: string
  snapshotDate: string // ISO 8601
  ratesUsd: number
  ratesEur: number
  rows: PortfolioSnapshotRow[]
}

// Репозиторій зліпків портфеля. Один зліпок на (user_id, fiscal_year_key) —
// save() оновлює наявний запис за цей рік замість дублювання, тож можна
// безпечно перезаписувати (напр. переімпортувати тестові дані).
export const portfolioSnapshotsRepo = {
  async getAll(userId: string): Promise<LocalPortfolioSnapshot[]> {
    return db.portfolioSnapshots
      .where('user_id')
      .equals(userId)
      .filter((s) => s.deleted_at === null)
      .sortBy('fiscal_year_key')
  },

  async save(userId: string, input: SavePortfolioSnapshotInput): Promise<void> {
    const now = new Date().toISOString()
    const existing = await db.portfolioSnapshots
      .where('user_id')
      .equals(userId)
      .filter((s) => s.fiscal_year_key === input.fiscalYearKey && s.deleted_at === null)
      .first()

    const snapshot: LocalPortfolioSnapshot = {
      id: existing?.id ?? uuidv4(),
      user_id: userId,
      fiscal_year_key: input.fiscalYearKey,
      fiscal_year_label: input.fiscalYearLabel,
      snapshot_date: input.snapshotDate,
      rates_usd: input.ratesUsd,
      rates_eur: input.ratesEur,
      rows: input.rows,
      created_at: existing?.created_at ?? now,
      updated_at: now,
      deleted_at: null,
      _sync_status: 'pending',
      _sync_error: null,
      _local_updated_at: Date.now(),
    }

    await db.portfolioSnapshots.put(snapshot)
  },
}
