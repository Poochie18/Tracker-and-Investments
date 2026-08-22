import { db } from '@/lib/db'

// ============================================================
// Дрібні dev-утиліти для роботи з локальними даними під час тестування.
// Викликаються тільки вручну з UI (dev-only кнопки в Settings).
// ============================================================

// Видаляє ВСІ транзакції користувача (для повторного тестування з чистого аркуша).
// Категорії й рахунок залишаються.
export async function clearAllTransactions(userId: string): Promise<number> {
  const ids = await db.transactions.where('user_id').equals(userId).primaryKeys()
  await db.transactions.bulkDelete(ids)
  return ids.length
}
