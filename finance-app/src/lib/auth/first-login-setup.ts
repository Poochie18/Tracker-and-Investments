import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { ALL_DEFAULT_CATEGORIES } from '@/lib/db/seed'
import type { LocalAccount, LocalCategory } from '@/lib/db/schema'

// Видаляє дублікати категорій, залишаючи по одному запису на (name+type).
// Транзакції, що посилаються на видалені записи, переприв'язуються до збереженого.
export async function deduplicateCategories(userId: string): Promise<number> {
  const all = await db.categories.where('user_id').equals(userId).toArray()

  // Групуємо по ключу name|type
  const groups = new Map<string, LocalCategory[]>()
  for (const cat of all) {
    const key = `${cat.name}|${cat.type}`
    const arr = groups.get(key) ?? []
    arr.push(cat)
    groups.set(key, arr)
  }

  let removed = 0
  for (const cats of groups.values()) {
    if (cats.length <= 1) continue

    // Залишаємо перший запис (найменший sort_order або перший за порядком)
    cats.sort((a, b) => a.sort_order - b.sort_order)
    const keep = cats[0]
    const toDelete = cats.slice(1)

    for (const del of toDelete) {
      // Переприв'язуємо транзакції
      const txs = await db.transactions.where('category_id').equals(del.id).toArray()
      for (const tx of txs) {
        await db.transactions.update(tx.id, {
          category_id: keep.id,
          _sync_status: 'pending',
          _local_updated_at: Date.now(),
        })
      }
      // Видаляємо з Dexie і Supabase
      await db.categories.delete(del.id)
      await supabase.from('categories').delete().eq('id', del.id)
      removed++
    }
  }

  return removed
}

export async function isFirstLogin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (error) throw error
  return !data || data.length === 0
}

// При першому вході: створюємо рахунок і категорії в Supabase,
// а потім одразу зберігаємо їх у Dexie зі статусом 'synced'.
// Це критично — без Dexie запису UI не побачить жодних даних.
export async function setupFirstLogin(userId: string): Promise<void> {
  // Другий захист: якщо категорії вже є в Supabase — хтось встиг створити їх раніше
  const { data: existingCats } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
  if (existingCats && existingCats.length > 0) return

  const now = new Date().toISOString()
  const localNow = Date.now()

  // ── Крок 1: Рахунок ──────────────────────────────────────
  const accountId = uuidv4()
  const { error: accountError } = await supabase.from('accounts').insert({
    id: accountId,
    user_id: userId,
    name: 'Головний',
    currency: 'UAH',
    is_archived: false,
    created_at: now,
    updated_at: now,
  })
  if (accountError) throw accountError

  const localAccount: LocalAccount = {
    id: accountId,
    user_id: userId,
    name: 'Головний',
    currency: 'UAH',
    is_archived: false,
    created_at: now,
    updated_at: now,
    _sync_status: 'synced',
    _sync_error: null,
    _local_updated_at: localNow,
  }
  await db.accounts.add(localAccount)

  // ── Крок 2: Категорії ─────────────────────────────────────
  const categories = ALL_DEFAULT_CATEGORIES.map((cat, index) => ({
    id: uuidv4(),
    user_id: userId,
    name: cat.name,
    type: cat.type,
    icon_name: cat.icon_name,
    color_hex: cat.color_hex,
    sort_order: index,
    is_archived: false,
    is_system: true,
    created_at: now,
    updated_at: now,
  }))

  const { error: categoriesError } = await supabase.from('categories').insert(categories)
  if (categoriesError) throw categoriesError

  const localCategories: LocalCategory[] = categories.map((cat) => ({
    ...cat,
    _sync_status: 'synced',
    _sync_error: null,
    _local_updated_at: localNow,
  }))
  await db.categories.bulkAdd(localCategories)
}
