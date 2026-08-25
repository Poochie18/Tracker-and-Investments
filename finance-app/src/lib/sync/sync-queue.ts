import type { EntityTable } from 'dexie'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import type {
  LocalTransaction, LocalCategory, LocalAccount, LocalInvestment, LocalDepositContribution,
  LocalBondCouponDate, LocalBondLot, LocalPortfolioSnapshot, SyncStatus,
} from '@/lib/db/schema'

// ============================================================
// Sync Queue — відповідає за push pending записів у Supabase.
//
// Алгоритм для кожної таблиці:
// 1. Вибрати всі записи з _sync_status === 'pending'
// 2. Одним запитом upsert-нути весь пакет у Supabase (insert або update)
// 3. Успіх → всі _sync_status = 'synced', _sync_error = null
// 4. Помилка пакету → падаємо на по-рядковий upsert (ізолюємо саме
//    проблемний рядок, решта валідних не блокуються ним)
//
// Раніше кожен pending-рядок ішов ОКРЕМИМ HTTP-запитом — при синку
// Binance (десятки монет за раз) це було десятки запитів у мережу
// одночасно. Пакетний upsert (масив рядків в один .upsert()) робить
// це одним запитом; per-row fallback лишається лише для рідкісного
// випадку, коли сам пакет повністю відхилено (напр. один "битий" рядок).
//
// upsert (а не insert/update окремо) — тому що ми не знаємо
// чи запис вже є на сервері (міг бути створений на іншому пристрої).
// ============================================================

export interface PushResult {
  successCount: number
  errorCount: number
  errors: string[]
}

interface SyncFields {
  _sync_status: SyncStatus
  _sync_error: string | null
  _local_updated_at: number
}

function stripLocalFields<T extends SyncFields>(record: T): Omit<T, keyof SyncFields> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- деструктуризація навмисно відкидає ці поля
  const { _sync_status, _sync_error, _local_updated_at, ...rest } = record
  return rest
}

// Спільна логіка пушу для будь-якої з восьми таблиць — відрізняються лише
// Dexie-таблиця, назва таблиці в Supabase і label для повідомлень помилок.
async function pushTable<T extends { id: string } & SyncFields>(
  table: EntityTable<T, 'id'>,
  supabaseTable: string,
  label: string,
  userId: string
): Promise<PushResult> {
  const pending = await table
    .where('user_id')
    .equals(userId)
    .filter((r) => r._sync_status === 'pending')
    .toArray()

  if (pending.length === 0) return { successCount: 0, errorCount: 0, errors: [] }

  const rows = pending.map(stripLocalFields)
  const { error } = await supabase.from(supabaseTable).upsert(rows, { onConflict: 'id' })

  if (!error) {
    await Promise.all(
      pending.map((r) => table.update(r.id, { _sync_status: 'synced', _sync_error: null } as Partial<T>))
    )
    return { successCount: pending.length, errorCount: 0, errors: [] }
  }

  // Пакет впав повністю (напр. один рядок порушує constraint) — з'ясовуємо
  // ПО-РЯДКОВО, який саме, щоб не блокувати синк усіх інших валідних записів.
  const result: PushResult = { successCount: 0, errorCount: 0, errors: [] }
  for (const record of pending) {
    const { error: rowError } = await supabase
      .from(supabaseTable)
      .upsert(stripLocalFields(record), { onConflict: 'id' })

    if (rowError) {
      result.errorCount++
      result.errors.push(`${label} ${record.id}: ${rowError.message}`)
      await table.update(record.id, { _sync_status: 'error', _sync_error: rowError.message } as Partial<T>)
    } else {
      result.successCount++
      await table.update(record.id, { _sync_status: 'synced', _sync_error: null } as Partial<T>)
    }
  }

  return result
}

// Чи є взагалі pending записи?
export async function hasPendingRecords(userId: string): Promise<boolean> {
  const [txCount, catCount, accCount, invCount, depContribCount, bondDateCount, bondLotCount, snapshotCount] = await Promise.all([
    db.transactions.where('user_id').equals(userId).filter((t) => t._sync_status === 'pending').count(),
    db.categories.where('user_id').equals(userId).filter((c) => c._sync_status === 'pending').count(),
    db.accounts.where('user_id').equals(userId).filter((a) => a._sync_status === 'pending').count(),
    db.investments.where('user_id').equals(userId).filter((i) => i._sync_status === 'pending').count(),
    db.depositContributions.where('user_id').equals(userId).filter((c) => c._sync_status === 'pending').count(),
    db.bondCouponDates.where('user_id').equals(userId).filter((d) => d._sync_status === 'pending').count(),
    db.bondLots.where('user_id').equals(userId).filter((l) => l._sync_status === 'pending').count(),
    db.portfolioSnapshots.where('user_id').equals(userId).filter((s) => s._sync_status === 'pending').count(),
  ])
  return txCount + catCount + accCount + invCount + depContribCount + bondDateCount + bondLotCount + snapshotCount > 0
}

// Рахуємо кількість помилок (для SyncStatusIndicator)
export async function countSyncErrors(userId: string): Promise<number> {
  const [txErr, catErr, accErr, invErr, depContribErr, bondDateErr, bondLotErr, snapshotErr] = await Promise.all([
    db.transactions.where('user_id').equals(userId).filter((t) => t._sync_status === 'error').count(),
    db.categories.where('user_id').equals(userId).filter((c) => c._sync_status === 'error').count(),
    db.accounts.where('user_id').equals(userId).filter((a) => a._sync_status === 'error').count(),
    db.investments.where('user_id').equals(userId).filter((i) => i._sync_status === 'error').count(),
    db.depositContributions.where('user_id').equals(userId).filter((c) => c._sync_status === 'error').count(),
    db.bondCouponDates.where('user_id').equals(userId).filter((d) => d._sync_status === 'error').count(),
    db.bondLots.where('user_id').equals(userId).filter((l) => l._sync_status === 'error').count(),
    db.portfolioSnapshots.where('user_id').equals(userId).filter((s) => s._sync_status === 'error').count(),
  ])
  return txErr + catErr + accErr + invErr + depContribErr + bondDateErr + bondLotErr + snapshotErr
}

// Головна функція черги: push всіх pending записів, кожна таблиця — одним
// пакетним запитом (замість запиту на кожен рядок).
export async function flushSyncQueue(userId: string): Promise<PushResult> {
  const [txResult, catResult, accResult, invResult, depContribResult, bondDateResult, bondLotResult, snapshotResult] = await Promise.all([
    pushTable<LocalTransaction>(db.transactions, 'transactions', 'tx', userId),
    pushTable<LocalCategory>(db.categories, 'categories', 'cat', userId),
    pushTable<LocalAccount>(db.accounts, 'accounts', 'acc', userId),
    pushTable<LocalInvestment>(db.investments, 'investments', 'inv', userId),
    pushTable<LocalDepositContribution>(db.depositContributions, 'deposit_contributions', 'dep-contrib', userId),
    pushTable<LocalBondCouponDate>(db.bondCouponDates, 'bond_coupon_dates', 'bond-date', userId),
    pushTable<LocalBondLot>(db.bondLots, 'bond_lots', 'bond-lot', userId),
    pushTable<LocalPortfolioSnapshot>(db.portfolioSnapshots, 'portfolio_snapshots', 'snapshot', userId),
  ])

  return {
    successCount: txResult.successCount + catResult.successCount + accResult.successCount + invResult.successCount + depContribResult.successCount + bondDateResult.successCount + bondLotResult.successCount + snapshotResult.successCount,
    errorCount: txResult.errorCount + catResult.errorCount + accResult.errorCount + invResult.errorCount + depContribResult.errorCount + bondDateResult.errorCount + bondLotResult.errorCount + snapshotResult.errorCount,
    errors: [...txResult.errors, ...catResult.errors, ...accResult.errors, ...invResult.errors, ...depContribResult.errors, ...bondDateResult.errors, ...bondLotResult.errors, ...snapshotResult.errors],
  }
}
