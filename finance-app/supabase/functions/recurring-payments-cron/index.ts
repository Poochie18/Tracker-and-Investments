// Edge Function: генерація транзакцій з регулярних платежів — коли
// застосунок ЗАКРИТИЙ (поки він відкритий, те саме робить клієнт:
// sync-engine.ts pull + use-recurring-auto-generate.ts). Викликається
// pg_cron кожні 15 хв (013_recurring_payments.sql) — НЕ user JWT, а
// власний CRON_SECRET у заголовку (verify_jwt=false, див. config.toml —
// pg_cron не має користувацької сесії).
//
// Push-сповіщення поки закоментовано (sendPushToUsers нижче) — лишаємо
// тільки автоматичне додавання транзакції. Щоб повернути: розкоментувати
// імпорт web-push, sendPushToUsers і його викликання, плюс
// subscribeToPush у src/features/transactions/components/AddTransactionScreen.tsx.
import { addDays, addWeeks, addMonths, addQuarters, addYears, format } from 'npm:date-fns@4'
// import webpush from 'npm:web-push@3'
import { withCors, jsonResponse } from '../_shared/cors.ts'
import { getServiceRoleClient } from '../_shared/auth.ts'

type Frequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

interface RecurringRow {
  id: string
  user_id: string
  name: string
  type: 'expense' | 'income'
  amount: number
  currency: string
  category_id: string
  account_id: string
  comment: string | null
  frequency: Frequency
  start_date: string
  start_time: string
  end_date: string | null
  is_active: boolean
  last_generated_date: string | null
}

// ── Розклад — продубльовано з src/features/transactions/recurring-schedule.ts ──
// (Deno Edge Function не імпортує код з src/ фронтенду) — тримай
// синхронізовано з клієнтською версією при зміні логіки розкладу.

function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey.slice(0, 10)}T12:00:00`)
}

function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function getNextOccurrenceDate(frequency: Frequency, fromDateKey: string): string {
  const from = parseDateKey(fromDateKey)
  switch (frequency) {
    case 'daily': return toDateKey(addDays(from, 1))
    case 'weekly': return toDateKey(addWeeks(from, 1))
    case 'monthly': return toDateKey(addMonths(from, 1))
    case 'quarterly': return toDateKey(addQuarters(from, 1))
    case 'yearly': return toDateKey(addYears(from, 1))
    case 'once': return fromDateKey.slice(0, 10)
  }
}

function getDueOccurrences(r: RecurringRow, nowIso: string): string[] {
  if (!r.is_active) return []

  const startKey = r.start_date.slice(0, 10)
  const nowKey = nowIso.slice(0, 10)
  const endKey = r.end_date ? r.end_date.slice(0, 10) : null

  if (startKey > nowKey) return []
  if (endKey && startKey > endKey) return []

  if (r.frequency === 'once') return r.last_generated_date ? [] : [startKey]

  const occurrences: string[] = []
  let cursor = r.last_generated_date
    ? getNextOccurrenceDate(r.frequency, r.last_generated_date.slice(0, 10))
    : startKey

  let guard = 0
  while (cursor <= nowKey && (!endKey || cursor <= endKey) && guard < 10000) {
    occurrences.push(cursor)
    cursor = getNextOccurrenceDate(r.frequency, cursor)
    guard++
  }

  return occurrences
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }))

  const cronSecret = Deno.env.get('CRON_SECRET')
  const authHeader = req.headers.get('Authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return jsonResponse({ error: 'Немає доступу' }, 401)
  }

  try {
    const admin = getServiceRoleClient()
    const now = new Date().toISOString()

    const { data: recurring, error } = await admin
      .from('recurring_payments')
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null)
    if (error) throw error

    let generatedCount = 0
    // const userIdsToNotify = new Set<string>() // для sendPushToUsers, поки закоментовано

    for (const r of (recurring ?? []) as RecurringRow[]) {
      const dueDates = getDueOccurrences(r, now)
      if (dueDates.length === 0) continue

      const rows = dueDates.map((dateKey) => {
        const [hours, minutes] = r.start_time.split(':').map(Number)
        const date = new Date(`${dateKey}T00:00:00.000Z`)
        date.setUTCHours(hours || 0, minutes || 0, 0, 0)
        return {
          id: crypto.randomUUID(),
          user_id: r.user_id,
          account_id: r.account_id,
          category_id: r.category_id,
          type: r.type,
          amount: r.amount,
          currency: r.currency,
          date: date.toISOString(),
          comment: r.comment ?? r.name,
        }
      })

      // service_role обходить RLS — вставляємо напряму, це і є сенс cron
      // функції (клієнт офлайн, не може сам записати в Dexie/pending чергу).
      const { error: insertErr } = await admin.from('transactions').insert(rows)
      if (insertErr) {
        console.error(`recurring ${r.id}: insert failed`, insertErr.message)
        continue // не зсуваємо last_generated_date — спробує знову наступний тік
      }

      generatedCount += rows.length
      // userIdsToNotify.add(r.user_id) // для sendPushToUsers, поки закоментовано

      await admin
        .from('recurring_payments')
        .update({ last_generated_date: dueDates[dueDates.length - 1] })
        .eq('id', r.id)
    }

    // if (userIdsToNotify.size > 0) {
    //   await sendPushToUsers(admin, Array.from(userIdsToNotify))
    // }

    return jsonResponse({ generatedCount })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Невідома помилка'
    return jsonResponse({ error: message }, 500)
  }
})

// Push-сповіщення закоментовано (поки вистачає автоматичного додавання
// транзакції) — розкоментувати разом з імпортом web-push вище і викликом
// у Deno.serve вище, коли знадобиться push.
//
// async function sendPushToUsers(admin: ReturnType<typeof getServiceRoleClient>, userIds: string[]): Promise<void> {
//   const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
//   const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
//   const vapidSubject = Deno.env.get('VAPID_SUBJECT')
//   if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) return
//
//   webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
//
//   const { data: subs } = await admin
//     .from('push_subscriptions')
//     .select('id, endpoint, p256dh, auth')
//     .in('user_id', userIds)
//   if (!subs || subs.length === 0) return
//
//   await Promise.all(
//     subs.map(async (sub) => {
//       try {
//         await webpush.sendNotification(
//           { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
//           JSON.stringify({ title: 'Регулярний платіж', body: 'Створено нову транзакцію за розкладом' })
//         )
//       } catch (err) {
//         // 404/410 — підписка більше не дійсна (браузер відписався/скинув
//         // дані) — прибираємо, щоб не намагатись знову щотижня.
//         const statusCode = (err as { statusCode?: number }).statusCode
//         if (statusCode === 404 || statusCode === 410) {
//           await admin.from('push_subscriptions').delete().eq('id', sub.id)
//         } else {
//           console.error('push failed', sub.id, err)
//         }
//       }
//     })
//   )
// }
