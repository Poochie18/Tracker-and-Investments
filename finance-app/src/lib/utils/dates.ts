import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  format, isToday, isYesterday, subDays,
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
    default:
      return format(anchor, 'LLLL yyyy', { locale: uk })
  }
}

// Швидкі дати для AddTransactionScreen
export const QUICK_DATES = [
  { label: 'Сьогодні', getDate: () => new Date() },
  { label: 'Вчора', getDate: () => subDays(new Date(), 1) },
  { label: '2 дні тому', getDate: () => subDays(new Date(), 2) },
] as const
