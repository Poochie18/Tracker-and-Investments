import { addDays, addWeeks, addMonths, addQuarters, addYears, format } from 'date-fns'
import type { LocalRecurringPayment, RecurringFrequency } from '@/lib/db/schema'

// ============================================================
// Чиста логіка розкладу регулярних платежів — без жодного звернення до
// Dexie/Supabase, щоб її можна було легко юніт-тестувати і (майже
// незмінно) продублювати в Edge Function (Deno не імпортує з src/).
//
// Дати всюди — рядки 'yyyy-MM-dd' (без часу): генерація рахується
// подобово, час (start_time) впливає лише на те, о котрій годині
// показати push-нагадування, не на те, ЯКОГО дня.
// ============================================================

const DATE_KEY_FORMAT = 'yyyy-MM-dd'

function toDateKey(date: Date): string {
  return format(date, DATE_KEY_FORMAT)
}

// Полудень — щоб addDays/addMonths не "з'їхали" на сусідній день через
// перехід літнього/зимового часу в локальній таймзоні браузера.
function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey.slice(0, 10)}T12:00:00`)
}

export type RecurringSchedule = Pick<
  LocalRecurringPayment,
  'frequency' | 'start_date' | 'end_date' | 'last_generated_date' | 'is_active'
>

export const RECURRING_FREQUENCY_META: Record<RecurringFrequency, { label: string }> = {
  once: { label: 'Одноразово' },
  daily: { label: 'Щодня' },
  weekly: { label: 'Щотижня' },
  monthly: { label: 'Щомісяця' },
  quarterly: { label: 'Щокварталу' },
  yearly: { label: 'Щороку' },
}

export const RECURRING_FREQUENCIES: RecurringFrequency[] = [
  'once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly',
]

// Наступна дата в розкладі після fromDateKey для даної частоти.
// Для 'once' наступної дати не існує — повертає той самий ключ
// (виклик має самостійно не звертатись сюди для 'once').
export function getNextOccurrenceDate(frequency: RecurringFrequency, fromDateKey: string): string {
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

// Усі дати, за які ще не згенеровано транзакцію, аж до nowIso включно
// (і не пізніше end_date) — застосовується і клієнтською "наздоганяючою"
// генерацією при вході в застосунок (може повернути кілька дат одразу,
// якщо додаток довго не відкривали), і серверним cron (там nowIso —
// момент тіку).
export function getDueOccurrences(recurring: RecurringSchedule, nowIso: string): string[] {
  if (!recurring.is_active) return []

  const startKey = recurring.start_date.slice(0, 10)
  const nowKey = nowIso.slice(0, 10)
  const endKey = recurring.end_date ? recurring.end_date.slice(0, 10) : null

  if (startKey > nowKey) return [] // ще не настав час першого випадку
  if (endKey && startKey > endKey) return [] // розклад закінчився ще до початку

  if (recurring.frequency === 'once') {
    return recurring.last_generated_date ? [] : [startKey]
  }

  const occurrences: string[] = []
  let cursor = recurring.last_generated_date
    ? getNextOccurrenceDate(recurring.frequency, recurring.last_generated_date.slice(0, 10))
    : startKey

  // guard — захист від зависання; з великим запасом (навіть щоденний
  // платіж без end_date, забутий на роки, впреться в цю межу раніше,
  // ніж стане проблемою продуктивності).
  let guard = 0
  while (cursor <= nowKey && (!endKey || cursor <= endKey) && guard < 10000) {
    occurrences.push(cursor)
    cursor = getNextOccurrenceDate(recurring.frequency, cursor)
    guard++
  }

  return occurrences
}

// Найближча дата випадку (для показу в списку "Регулярні") — на відміну
// від getDueOccurrences, не обмежена "зараз": показує, коли платіж
// спрацює наступного разу, навіть якщо це в майбутньому. null — розклад
// уже завершився (одноразовий вже згенерований, або минув end_date).
export function getNextDisplayDate(recurring: RecurringSchedule): string | null {
  if (!recurring.is_active) return null

  const endKey = recurring.end_date ? recurring.end_date.slice(0, 10) : null

  if (recurring.frequency === 'once') {
    if (recurring.last_generated_date) return null
    const startKey = recurring.start_date.slice(0, 10)
    return !endKey || startKey <= endKey ? startKey : null
  }

  const next = recurring.last_generated_date
    ? getNextOccurrenceDate(recurring.frequency, recurring.last_generated_date.slice(0, 10))
    : recurring.start_date.slice(0, 10)

  return !endKey || next <= endKey ? next : null
}
