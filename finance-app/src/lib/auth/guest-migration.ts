import type { EntityTable } from 'dexie'
import { db } from '@/lib/db'

// ============================================================
// Перенесення гостьових даних (user_id = guestId) на реальний акаунт
// (user_id = realUserId) після реєстрації/входу через Google.
//
// Записи лишаються з тими самими id (це UUID, унікальні на весь
// застосунок), просто перепризначаємо user_id і позначаємо 'pending' —
// далі SyncEngine сам виштовхає їх у Supabase.
// ============================================================

async function migrateTable<T extends { id: string; user_id: string; _sync_status: string; _local_updated_at: number }>(
  table: EntityTable<T, 'id'>,
  guestId: string,
  realUserId: string,
  now: number
): Promise<void> {
  const rows = await table.where('user_id').equals(guestId).toArray()
  if (rows.length === 0) return

  // bulkPut оновлює записи ЗА ТИМ САМИМ id (тільки user_id міняється) —
  // це вже й є "перенесення", нового id не з'являється. bulkDelete(rows
  // .map(r => r.id)) тут раніше видаляв ті ж самі id одразу після
  // bulkPut — тобто стирав щойно перенесені записи (акаунти, категорії,
  // транзакції, депозити — усе) ще до першого sync-циклу. Саме тому
  // гостьові дані (напр. депозит, створений як гість) зникали і ніколи
  // не потрапляли в Supabase.
  await table.bulkPut(
    rows.map((r) => ({ ...r, user_id: realUserId, _sync_status: 'pending', _local_updated_at: now }))
  )
}

export async function migrateGuestDataToAccount(guestId: string, realUserId: string): Promise<void> {
  const now = Date.now()

  // Порядок не важливий — foreign key тут суто логічний (Dexie не
  // перевіряє constraints), а _sync_status: 'pending' відправить усе
  // разом у наступному sync-циклі незалежно від порядку вставки.
  await Promise.all([
    migrateTable(db.accounts, guestId, realUserId, now),
    migrateTable(db.categories, guestId, realUserId, now),
    migrateTable(db.transactions, guestId, realUserId, now),
    migrateTable(db.tags, guestId, realUserId, now),
    migrateTable(db.investments, guestId, realUserId, now),
    migrateTable(db.depositContributions, guestId, realUserId, now),
    migrateTable(db.bondCouponDates, guestId, realUserId, now),
    migrateTable(db.bondLots, guestId, realUserId, now),
    migrateTable(db.portfolioSnapshots, guestId, realUserId, now),
  ])
}
