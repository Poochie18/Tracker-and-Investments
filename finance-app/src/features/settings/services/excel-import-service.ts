import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import { categoriesRepo } from '@/features/transactions/repositories/categories-repo'
import type { ParsedExcelFile } from './excel-import-parser'
import type { LocalCategory, LocalTransaction, TransactionType } from '@/lib/db/schema'

// ============================================================
// Сервіс імпорту розпарсених Excel-транзакцій у Dexie.
// ============================================================

export interface CategoryGap {
  name: string
  type: TransactionType
}

// Палітра для автостворених категорій — та сама, що й у ManageCategoriesScreen,
// щоб виглядали консистентно; користувач зможе перефарбувати/перейменувати пізніше.
const AUTO_CATEGORY_COLORS = [
  '#00c896', '#f4b942', '#ff6b6b', '#51cf66', '#74c0fc',
  '#ff922b', '#da77f2', '#f783ac', '#a9e34b', '#66d9e8',
]
// 'MoreHorizontal' — той самий дефолт, що й для вручну створених категорій
// у ManageCategoriesScreen (реально зареєстрована іконка в category-icons.ts).
const AUTO_CATEGORY_ICON = 'MoreHorizontal'

// Порівнює розпарсені рядки з наявними категоріями користувача (за назвою+типом)
// і повертає унікальний список тих, яких бракує.
export function findMissingCategories(
  parsed: Pick<ParsedExcelFile, 'expenses' | 'incomes'>,
  existingCategories: LocalCategory[]
): CategoryGap[] {
  const existingKeys = new Set(existingCategories.map((c) => `${c.name}|${c.type}`))
  const seen = new Set<string>()
  const gaps: CategoryGap[] = []

  const scan = (rows: ParsedExcelFile['expenses'], type: TransactionType) => {
    for (const row of rows) {
      const key = `${row.category}|${type}`
      if (existingKeys.has(key) || seen.has(key)) continue
      seen.add(key)
      gaps.push({ name: row.category, type })
    }
  }

  scan(parsed.expenses, 'expense')
  scan(parsed.incomes, 'income')
  return gaps
}

// Створює всі відсутні категорії одним викликом.
export async function createMissingCategories(userId: string, gaps: CategoryGap[]): Promise<void> {
  await Promise.all(
    gaps.map((gap, i) =>
      categoriesRepo.create(userId, {
        name: gap.name,
        type: gap.type,
        icon_name: AUTO_CATEGORY_ICON,
        color_hex: AUTO_CATEGORY_COLORS[i % AUTO_CATEGORY_COLORS.length],
      })
    )
  )
}

// Основний імпорт: резолвить category_id за назвою+типом і вставляє
// транзакції в Dexie зі статусом 'pending' (підуть у Supabase при синку).
// Викликати лише коли findMissingCategories() повертає порожній масив —
// інакше рядки з невідомою категорією будуть пропущені мовчки.
export async function importParsedTransactions(
  userId: string,
  accountId: string,
  parsed: Pick<ParsedExcelFile, 'expenses' | 'incomes'>
): Promise<{ created: number; skipped: number }> {
  const categories = await db.categories.where('user_id').equals(userId).toArray()
  const categoryByKey = new Map(categories.map((c) => [`${c.name}|${c.type}`, c]))

  const now = new Date().toISOString()
  const localNow = Date.now()
  const transactions: LocalTransaction[] = []
  let skipped = 0

  const addRows = (rows: ParsedExcelFile['expenses'], type: TransactionType) => {
    for (const row of rows) {
      const category = categoryByKey.get(`${row.category}|${type}`)
      if (!category) {
        skipped++
        continue
      }
      transactions.push({
        id: uuidv4(),
        user_id: userId,
        account_id: accountId,
        category_id: category.id,
        type,
        amount: Math.round(row.amount * 100),
        currency: 'UAH',
        date: row.date.toISOString(),
        comment: row.comment,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        _sync_status: 'pending',
        _sync_error: null,
        _local_updated_at: localNow,
      })
    }
  }

  addRows(parsed.expenses, 'expense')
  addRows(parsed.incomes, 'income')

  await db.transactions.bulkAdd(transactions)
  return { created: transactions.length, skipped }
}
