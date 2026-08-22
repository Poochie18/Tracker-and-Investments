import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import type {
  LocalTransaction, LocalCategory, LocalAccount, LocalInvestment, LocalDepositContribution,
} from '@/lib/db/schema'
// Типи використовуються у деструктуризації нижче
void (0 as unknown as LocalTransaction | LocalCategory | LocalAccount | LocalInvestment | LocalDepositContribution)

// ============================================================
// Sync Queue — відповідає за push pending записів у Supabase.
//
// Алгоритм для кожної таблиці:
// 1. Вибрати всі записи з _sync_status === 'pending'
// 2. Спробувати upsert у Supabase (insert або update)
// 3. Успіх → _sync_status = 'synced', _sync_error = null
// 4. Помилка → _sync_status = 'error', зберегти повідомлення
//
// upsert (а не insert/update окремо) — тому що ми не знаємо
// чи запис вже є на сервері (міг бути створений на іншому пристрої).
// ============================================================

export interface PushResult {
  successCount: number
  errorCount: number
  errors: string[]
}

// Push транзакцій
async function pushTransactions(userId: string): Promise<PushResult> {
  const pending = await db.transactions
    .where('user_id').equals(userId)
    .filter((t) => t._sync_status === 'pending')
    .toArray()

  if (pending.length === 0) return { successCount: 0, errorCount: 0, errors: [] }

  const result: PushResult = { successCount: 0, errorCount: 0, errors: [] }

  for (const tx of pending) {
    // Готуємо об'єкт без локальних полів (Supabase їх не знає)
    const { _sync_status, _sync_error, _local_updated_at, ...supabaseData } = tx

    const { error } = await supabase
      .from('transactions')
      .upsert(supabaseData, { onConflict: 'id' })

    if (error) {
      result.errorCount++
      result.errors.push(`tx ${tx.id}: ${error.message}`)
      await db.transactions.update(tx.id, {
        _sync_status: 'error',
        _sync_error: error.message,
      })
    } else {
      result.successCount++
      await db.transactions.update(tx.id, {
        _sync_status: 'synced',
        _sync_error: null,
      })
    }
  }

  return result
}

// Push категорій
async function pushCategories(userId: string): Promise<PushResult> {
  const pending = await db.categories
    .where('user_id').equals(userId)
    .filter((c) => c._sync_status === 'pending')
    .toArray()

  if (pending.length === 0) return { successCount: 0, errorCount: 0, errors: [] }

  const result: PushResult = { successCount: 0, errorCount: 0, errors: [] }

  for (const cat of pending) {
    const { _sync_status, _sync_error, _local_updated_at, ...supabaseData } = cat

    const { error } = await supabase
      .from('categories')
      .upsert(supabaseData, { onConflict: 'id' })

    if (error) {
      result.errorCount++
      result.errors.push(`cat ${cat.id}: ${error.message}`)
      await db.categories.update(cat.id, { _sync_status: 'error', _sync_error: error.message })
    } else {
      result.successCount++
      await db.categories.update(cat.id, { _sync_status: 'synced', _sync_error: null })
    }
  }

  return result
}

// Push рахунків
async function pushAccounts(userId: string): Promise<PushResult> {
  const pending = await db.accounts
    .where('user_id').equals(userId)
    .filter((a) => a._sync_status === 'pending')
    .toArray()

  if (pending.length === 0) return { successCount: 0, errorCount: 0, errors: [] }

  const result: PushResult = { successCount: 0, errorCount: 0, errors: [] }

  for (const acc of pending) {
    const { _sync_status, _sync_error, _local_updated_at, ...supabaseData } = acc

    const { error } = await supabase
      .from('accounts')
      .upsert(supabaseData, { onConflict: 'id' })

    if (error) {
      result.errorCount++
      result.errors.push(`acc ${acc.id}: ${error.message}`)
      await db.accounts.update(acc.id, { _sync_status: 'error', _sync_error: error.message })
    } else {
      result.successCount++
      await db.accounts.update(acc.id, { _sync_status: 'synced', _sync_error: null })
    }
  }

  return result
}

// Push інвестицій
async function pushInvestments(userId: string): Promise<PushResult> {
  const pending = await db.investments
    .where('user_id').equals(userId)
    .filter((i) => i._sync_status === 'pending')
    .toArray()

  if (pending.length === 0) return { successCount: 0, errorCount: 0, errors: [] }

  const result: PushResult = { successCount: 0, errorCount: 0, errors: [] }

  for (const inv of pending) {
    const { _sync_status, _sync_error, _local_updated_at, ...supabaseData } = inv

    const { error } = await supabase
      .from('investments')
      .upsert(supabaseData, { onConflict: 'id' })

    if (error) {
      result.errorCount++
      result.errors.push(`inv ${inv.id}: ${error.message}`)
      await db.investments.update(inv.id, { _sync_status: 'error', _sync_error: error.message })
    } else {
      result.successCount++
      await db.investments.update(inv.id, { _sync_status: 'synced', _sync_error: null })
    }
  }

  return result
}

// Push поповнень депозитів
async function pushDepositContributions(userId: string): Promise<PushResult> {
  const pending = await db.depositContributions
    .where('user_id').equals(userId)
    .filter((c) => c._sync_status === 'pending')
    .toArray()

  if (pending.length === 0) return { successCount: 0, errorCount: 0, errors: [] }

  const result: PushResult = { successCount: 0, errorCount: 0, errors: [] }

  for (const contrib of pending) {
    const { _sync_status, _sync_error, _local_updated_at, ...supabaseData } = contrib

    const { error } = await supabase
      .from('deposit_contributions')
      .upsert(supabaseData, { onConflict: 'id' })

    if (error) {
      result.errorCount++
      result.errors.push(`dep-contrib ${contrib.id}: ${error.message}`)
      await db.depositContributions.update(contrib.id, { _sync_status: 'error', _sync_error: error.message })
    } else {
      result.successCount++
      await db.depositContributions.update(contrib.id, { _sync_status: 'synced', _sync_error: null })
    }
  }

  return result
}

// Чи є взагалі pending записи?
export async function hasPendingRecords(userId: string): Promise<boolean> {
  const [txCount, catCount, accCount, invCount, depContribCount] = await Promise.all([
    db.transactions.where('user_id').equals(userId).filter((t) => t._sync_status === 'pending').count(),
    db.categories.where('user_id').equals(userId).filter((c) => c._sync_status === 'pending').count(),
    db.accounts.where('user_id').equals(userId).filter((a) => a._sync_status === 'pending').count(),
    db.investments.where('user_id').equals(userId).filter((i) => i._sync_status === 'pending').count(),
    db.depositContributions.where('user_id').equals(userId).filter((c) => c._sync_status === 'pending').count(),
  ])
  return txCount + catCount + accCount + invCount + depContribCount > 0
}

// Рахуємо кількість помилок (для SyncStatusIndicator)
export async function countSyncErrors(userId: string): Promise<number> {
  const [txErr, catErr, accErr, invErr, depContribErr] = await Promise.all([
    db.transactions.where('user_id').equals(userId).filter((t) => t._sync_status === 'error').count(),
    db.categories.where('user_id').equals(userId).filter((c) => c._sync_status === 'error').count(),
    db.accounts.where('user_id').equals(userId).filter((a) => a._sync_status === 'error').count(),
    db.investments.where('user_id').equals(userId).filter((i) => i._sync_status === 'error').count(),
    db.depositContributions.where('user_id').equals(userId).filter((c) => c._sync_status === 'error').count(),
  ])
  return txErr + catErr + accErr + invErr + depContribErr
}

// Головна функція черги: push всіх pending записів
export async function flushSyncQueue(userId: string): Promise<PushResult> {
  const [txResult, catResult, accResult, invResult, depContribResult] = await Promise.all([
    pushTransactions(userId),
    pushCategories(userId),
    pushAccounts(userId),
    pushInvestments(userId),
    pushDepositContributions(userId),
  ])

  return {
    successCount: txResult.successCount + catResult.successCount + accResult.successCount + invResult.successCount + depContribResult.successCount,
    errorCount: txResult.errorCount + catResult.errorCount + accResult.errorCount + invResult.errorCount + depContribResult.errorCount,
    errors: [...txResult.errors, ...catResult.errors, ...accResult.errors, ...invResult.errors, ...depContribResult.errors],
  }
}

