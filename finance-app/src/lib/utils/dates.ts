import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  format, isToday, isYesterday, subDays,
  addDays, addWeeks, subWeeks, addMonths, subMonths, addYears, subYears,
  isSameDay, isSameWeek, isSameMonth, isSameYear,
} from 'date-fns'
import { uk } from 'date-fns/locale'
import type { PeriodType } from '@/stores/ui-store'

export interface DateRange {
  from: Date
  to: Date
}

export function getPeriodRange(
  period: PeriodType,
  anchor = new Date(),
  custom?: { from: Date; to: Date } | null
): DateRange {
  switch (period) {
    case 'day':
      return { from: startOfDay(anchor), to: endOfDay(anchor) }
    case 'week':
      return {
        from: startOfWeek(anchor, { weekStartsOn: 1 }),
        to: endOfWeek(anchor, { weekStartsOn: 1 }),
      }
    case 'month':
      return { from: startOfMonth(anchor), to: endOfMonth(anchor) }
    case 'year':
      return { from: startOfYear(anchor), to: endOfYear(anchor) }
    case 'custom':
      if (custom) return { from: startOfDay(custom.from), to: endOfDay(custom.to) }
      return { from: startOfMonth(anchor), to: endOfMonth(anchor) }
    case 'all':
      // "Весь час" — беремо максимально широкий діапазон, щоб охопити
      // будь-яку транзакцію незалежно від дати.
      return { from: new Date(1970, 0, 1), to: endOfDay(new Date(2100, 0, 1)) }
    default:
      return { from: startOfMonth(anchor), to: endOfMonth(anchor) }
  }
}

// Заголовок для групування транзакцій по даті
export function formatGroupDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (isToday(date)) return 'Сьогодні'
  if (isYesterday(date)) return 'Вчора'
  return format(date, 'd MMMM yyyy', { locale: uk })
}

export function formatPeriodHeader(
  period: PeriodType,
  anchor = new Date(),
  custom?: { from: Date; to: Date } | null
): string {
  switch (period) {
    case 'day':
      return format(anchor, 'd MMMM yyyy', { locale: uk })
    case 'week': {
      const from = startOfWeek(anchor, { weekStartsOn: 1 })
      const to = endOfWeek(anchor, { weekStartsOn: 1 })
      return `${format(from, 'd MMM', { locale: uk })} — ${format(to, 'd MMM yyyy', { locale: uk })}`
    }
    case 'month':
      return format(anchor, 'LLLL yyyy', { locale: uk })
    case 'year':
      return format(anchor, 'yyyy')
    case 'custom':
      if (custom)
        return `${format(custom.from, 'd MMM', { locale: uk })} — ${format(custom.to, 'd MMM', { locale: uk })}`
      return format(anchor, 'LLLL yyyy', { locale: uk })
    case 'all':
      return 'Весь час'
    default:
      return format(anchor, 'LLLL yyyy', { locale: uk })
  }
}

// Зсуває якір періоду на один крок вперед/назад — для навігації
// "‹ попередній / наступний ›" на Overview і в списку транзакцій.
// 'custom' і 'year' навмисно без спеціальної обробки в UI (рік теж підтримуємо тут для повноти).
export function shiftPeriodAnchor(period: PeriodType, anchor: Date, direction: 1 | -1): Date {
  switch (period) {
    case 'day':
      return direction === 1 ? addDays(anchor, 1) : subDays(anchor, 1)
    case 'week':
      return direction === 1 ? addWeeks(anchor, 1) : subWeeks(anchor, 1)
    case 'month':
      return direction === 1 ? addMonths(anchor, 1) : subMonths(anchor, 1)
    case 'year':
      return direction === 1 ? addYears(anchor, 1) : subYears(anchor, 1)
    default:
      return anchor
  }
}

// Чи анкер вказує на "поточний" день/тиждень/місяць/рік — щоб ховати
// кнопку "Сьогодні", коли й так дивимось на актуальний період.
export function isCurrentPeriod(period: PeriodType, anchor: Date): boolean {
  const now = new Date()
  switch (period) {
    case 'day':
      return isSameDay(anchor, now)
    case 'week':
      return isSameWeek(anchor, now, { weekStartsOn: 1 })
    case 'month':
      return isSameMonth(anchor, now)
    case 'year':
      return isSameYear(anchor, now)
    default:
      return true
  }
}

// Швидкі дати для AddTransactionScreen
export const QUICK_DATES = [
  { label: 'Сьогодні', getDate: () => new Date() },
  { label: 'Вчора', getDate: () => subDays(new Date(), 1) },
  { label: '2 дні тому', getDate: () => subDays(new Date(), 2) },
] as const
