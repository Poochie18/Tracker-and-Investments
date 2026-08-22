import { db } from '@/lib/db'
import { categoriesRepo } from '@/features/transactions/repositories/categories-repo'
import { ALL_DEFAULT_CATEGORIES } from './seed'

// ============================================================
// Синхронізація дефолтних категорій для вже існуючого користувача.
//
// first-login-setup створює дефолтні категорії лише один раз —
// при першому вході. Коли список ALL_DEFAULT_CATEGORIES поповнюється
// новими категоріями (або назва старої уточнюється), уже заведені
// користувачі самі їх не отримають. Ця функція:
// 1. Перейменовує застарілі назви категорій на нові (той самий id,
//    щоб історичні транзакції лишились прив'язаними) — керується RENAMES.
// 2. Додає категорії з ALL_DEFAULT_CATEGORIES, яких ще немає (за назвою+типом).
// ============================================================

// Стара назва → нова назва (тільки категорії типу expense мають перейменування)
const RENAMES: Record<string, string> = {
  'Хоз товари': 'Господарські товари',
}

export interface CategorySyncResult {
  renamed: number
  created: number
}

export async function syncDefaultCategories(userId: string): Promise<CategorySyncResult> {
  const existing = await db.categories.where('user_id').equals(userId).toArray()
  let renamed = 0

  // ── Перейменування застарілих назв ──────────────────────
  for (const [oldName, newName] of Object.entries(RENAMES)) {
    const match = existing.find((c) => c.name === oldName)
    const alreadyRenamed = existing.some((c) => c.name === newName)
    if (match && !alreadyRenamed) {
      await categoriesRepo.update(match.id, { name: newName })
      match.name = newName // тримаємо локальний масив актуальним для наступного кроку
      renamed++
    }
  }

  // ── Додавання відсутніх дефолтних категорій ─────────────
  const existingKeys = new Set(existing.map((c) => `${c.name}|${c.type}`))
  let created = 0

  for (const def of ALL_DEFAULT_CATEGORIES) {
    const key = `${def.name}|${def.type}`
    if (existingKeys.has(key)) continue

    await categoriesRepo.create(userId, {
      name: def.name,
      type: def.type,
      icon_name: def.icon_name,
      color_hex: def.color_hex,
    })
    existingKeys.add(key)
    created++
  }

  return { renamed, created }
}
