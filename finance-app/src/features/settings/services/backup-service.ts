import { z } from 'zod'
import { db } from '@/lib/db'
import type { LocalAccount, LocalCategory, LocalTransaction } from '@/lib/db/schema'

// ============================================================
// BackupService — export/import всіх локальних даних у JSON.
//
// Формат файлу:
// { version, exportedAt, userId, accounts[], categories[], transactions[] }
//
// Два режими імпорту:
// - replace: очищаємо всі записи юзера, потім bulkPut
// - merge:   bulkPut без очищення (існуючі ID перезаписуються)
// ============================================================

const BACKUP_VERSION = 1

// ── Zod-схема для валідації файлу при імпорті ─────────────

const AccountSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  currency: z.string(),
  is_archived: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

const CategorySchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  type: z.enum(['expense', 'income']),
  icon_name: z.string(),
  color_hex: z.string(),
  sort_order: z.number(),
  is_archived: z.boolean(),
  is_system: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})

const TransactionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  account_id: z.string(),
  category_id: z.string(),
  type: z.enum(['expense', 'income']),
  amount: z.number(),
  currency: z.string(),
  date: z.string(),
  comment: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
})

const BackupSchema = z.object({
  version: z.number(),
  exportedAt: z.string(),
  userId: z.string(),
  accounts: z.array(AccountSchema),
  categories: z.array(CategorySchema),
  transactions: z.array(TransactionSchema),
})

type BackupData = z.infer<typeof BackupSchema>

// ── Експорт ───────────────────────────────────────────────

export async function exportBackup(userId: string): Promise<string> {
  const [accounts, categories, transactions] = await Promise.all([
    db.accounts.where('user_id').equals(userId).toArray(),
    db.categories.where('user_id').equals(userId).toArray(),
    db.transactions.where('user_id').equals(userId).toArray(),
  ])

  // Знімаємо локальні поля синхронізації — у файлі вони не потрібні
  const stripLocal = <T extends { _sync_status?: unknown; _sync_error?: unknown; _local_updated_at?: unknown }>(
    items: T[]
  ) =>
    items.map(({ _sync_status: _s, _sync_error: _e, _local_updated_at: _l, ...rest }) => rest)

  const backup: BackupData = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    userId,
    accounts: stripLocal(accounts) as BackupData['accounts'],
    categories: stripLocal(categories) as BackupData['categories'],
    transactions: stripLocal(transactions) as BackupData['transactions'],
  }

  return JSON.stringify(backup, null, 2)
}

// ── Збереження файлу (download або Web Share API) ─────────

export async function downloadBackup(userId: string): Promise<void> {
  const json = await exportBackup(userId)
  const date = new Date().toISOString().slice(0, 10)
  const filename = `finance-backup-${date}.json`

  // Web Share API — якщо підтримується (мобільні)
  if (navigator.share && navigator.canShare?.({ files: [new File([json], filename, { type: 'application/json' })] })) {
    const file = new File([json], filename, { type: 'application/json' })
    await navigator.share({ files: [file], title: 'Finance Backup' })
    return
  }

  // Fallback — звичайне завантаження
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Імпорт ────────────────────────────────────────────────

export type ImportMode = 'replace' | 'merge'

export async function importBackup(
  jsonStr: string,
  userId: string,
  mode: ImportMode
): Promise<void> {
  const parsed: unknown = JSON.parse(jsonStr)
  const result = BackupSchema.safeParse(parsed)

  if (!result.success) {
    throw new Error('Невірний формат файлу резервної копії')
  }

  const backup = result.data
  const now = Date.now()
  const isoNow = new Date().toISOString()

  const toLocalAccount = (a: BackupData['accounts'][number]): LocalAccount => ({
    ...a,
    user_id: userId,
    _sync_status: 'pending',
    _sync_error: null,
    _local_updated_at: now,
  })

  const toLocalCategory = (c: BackupData['categories'][number]): LocalCategory => ({
    ...c,
    user_id: userId,
    _sync_status: 'pending',
    _sync_error: null,
    _local_updated_at: now,
  })

  const toLocalTransaction = (t: BackupData['transactions'][number]): LocalTransaction => ({
    ...t,
    user_id: userId,
    _sync_status: 'pending',
    _sync_error: null,
    _local_updated_at: now,
  })

  if (mode === 'replace') {
    // Видаляємо всі поточні дані цього юзера
    await db.transaction('rw', [db.accounts, db.categories, db.transactions], async () => {
      await db.accounts.where('user_id').equals(userId).delete()
      await db.categories.where('user_id').equals(userId).delete()
      await db.transactions.where('user_id').equals(userId).delete()

      // Вставляємо відновлені дані з оновленою датою щоб sync пішов
      const accounts = backup.accounts.map((a) => ({ ...toLocalAccount(a), updated_at: isoNow }))
      const categories = backup.categories.map((c) => ({ ...toLocalCategory(c), updated_at: isoNow }))
      const transactions = backup.transactions.map((t) => ({ ...toLocalTransaction(t), updated_at: isoNow }))

      await db.accounts.bulkPut(accounts)
      await db.categories.bulkPut(categories)
      await db.transactions.bulkPut(transactions)
    })
  } else {
    // Merge — просто upsert (існуючі записи перезаписуються за ID)
    await db.accounts.bulkPut(backup.accounts.map(toLocalAccount))
    await db.categories.bulkPut(backup.categories.map(toLocalCategory))
    await db.transactions.bulkPut(backup.transactions.map(toLocalTransaction))
  }
}
