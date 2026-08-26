import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/db'

// Записи, які НЕ вдалось відправити в Supabase (_sync_status === 'error') —
// показуємо їх текст помилки в SyncStatusIndicator, інакше "Помилка
// синхронізації" нічого не каже про причину (RLS? constraint? offline?),
// і користувач не може повідомити, що саме зламалось.
export interface SyncErrorRow {
  table: string
  id: string
  message: string
}

const TABLES: { table: keyof typeof db; label: string }[] = [
  { table: 'transactions', label: 'транзакція' },
  { table: 'categories', label: 'категорія' },
  { table: 'accounts', label: 'рахунок' },
  { table: 'investments', label: 'інвестиція' },
  { table: 'depositContributions', label: 'поповнення депозиту' },
  { table: 'bondCouponDates', label: 'дата купону' },
  { table: 'bondLots', label: 'партія облігації' },
  { table: 'portfolioSnapshots', label: 'зліпок портфеля' },
]

export function useSyncErrors(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['sync-errors', userId],
    queryFn: async (): Promise<SyncErrorRow[]> => {
      const results = await Promise.all(
        TABLES.map(async ({ table, label }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- динамічний доступ по назві таблиці, конкретний тип тут не потрібен
          const rows = await (db[table] as any)
            .where('user_id').equals(userId)
            .filter((r: { _sync_status: string }) => r._sync_status === 'error')
            .toArray()
          return rows.map((r: { id: string; _sync_error: string | null }) => ({
            table: label,
            id: r.id,
            message: r._sync_error ?? 'Невідома помилка',
          }))
        })
      )
      return results.flat()
    },
    enabled: enabled && !!userId,
    // Дропдаун відкривають вручну — свіжі дані на кожен показ, не кешуємо
    staleTime: 0,
  })
}
