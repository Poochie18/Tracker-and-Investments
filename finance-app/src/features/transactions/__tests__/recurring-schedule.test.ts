import { describe, it, expect } from 'vitest'
import { getNextOccurrenceDate, getDueOccurrences, getNextDisplayDate, type RecurringSchedule } from '../recurring-schedule'

function makeSchedule(overrides: Partial<RecurringSchedule>): RecurringSchedule {
  return {
    frequency: 'monthly',
    start_date: '2026-01-01',
    end_date: null,
    last_generated_date: null,
    is_active: true,
    ...overrides,
  }
}

describe('getNextOccurrenceDate', () => {
  it('daily додає 1 день', () => {
    expect(getNextOccurrenceDate('daily', '2026-01-31')).toBe('2026-02-01')
  })
  it('weekly додає 7 днів', () => {
    expect(getNextOccurrenceDate('weekly', '2026-01-01')).toBe('2026-01-08')
  })
  it('monthly кліпає до кінця місяця, якщо такого дня нема (31 січня → 28 лютого)', () => {
    expect(getNextOccurrenceDate('monthly', '2026-01-31')).toBe('2026-02-28')
  })
  it('quarterly додає 3 місяці', () => {
    expect(getNextOccurrenceDate('quarterly', '2026-01-15')).toBe('2026-04-15')
  })
  it('yearly додає рік', () => {
    expect(getNextOccurrenceDate('yearly', '2026-03-01')).toBe('2027-03-01')
  })
})

describe('getDueOccurrences', () => {
  it('порожньо, якщо start_date у майбутньому', () => {
    const s = makeSchedule({ start_date: '2026-06-01' })
    expect(getDueOccurrences(s, '2026-01-01')).toEqual([])
  })

  it('порожньо, якщо is_active=false', () => {
    const s = makeSchedule({ is_active: false })
    expect(getDueOccurrences(s, '2026-06-01')).toEqual([])
  })

  it('перший випадок = start_date, якщо ще не генерували', () => {
    const s = makeSchedule({ frequency: 'monthly', start_date: '2026-01-01' })
    expect(getDueOccurrences(s, '2026-01-01')).toEqual(['2026-01-01'])
  })

  it('наздоганяє кілька пропущених місяців одразу (застосунок довго не відкривали)', () => {
    const s = makeSchedule({ frequency: 'monthly', start_date: '2026-01-01', last_generated_date: '2026-01-01' })
    expect(getDueOccurrences(s, '2026-04-15')).toEqual(['2026-02-01', '2026-03-01', '2026-04-01'])
  })

  it('once генерується рівно один раз', () => {
    const s = makeSchedule({ frequency: 'once', start_date: '2026-01-10' })
    expect(getDueOccurrences(s, '2026-02-01')).toEqual(['2026-01-10'])
    const alreadyDone = makeSchedule({ frequency: 'once', start_date: '2026-01-10', last_generated_date: '2026-01-10' })
    expect(getDueOccurrences(alreadyDone, '2026-02-01')).toEqual([])
  })

  it('не виходить за межу end_date', () => {
    const s = makeSchedule({
      frequency: 'monthly', start_date: '2026-01-01', end_date: '2026-02-15', last_generated_date: '2026-01-01',
    })
    expect(getDueOccurrences(s, '2026-06-01')).toEqual(['2026-02-01'])
  })

  it('нічого не повертає, якщо все вже згенеровано до "зараз"', () => {
    const s = makeSchedule({ frequency: 'daily', start_date: '2026-01-01', last_generated_date: '2026-01-05T00:00:00.000Z' })
    expect(getDueOccurrences(s, '2026-01-05T12:00:00.000Z')).toEqual([])
  })
})

describe('getNextDisplayDate', () => {
  it('показує start_date, якщо ще нічого не генерували', () => {
    const s = makeSchedule({ frequency: 'weekly', start_date: '2026-03-01' })
    expect(getNextDisplayDate(s)).toBe('2026-03-01')
  })

  it('показує наступну дату навіть у майбутньому (не обмежено "зараз")', () => {
    const s = makeSchedule({ frequency: 'yearly', start_date: '2026-01-01', last_generated_date: '2026-01-01' })
    expect(getNextDisplayDate(s)).toBe('2027-01-01')
  })

  it('null для завершеного once', () => {
    const s = makeSchedule({ frequency: 'once', start_date: '2026-01-01', last_generated_date: '2026-01-01' })
    expect(getNextDisplayDate(s)).toBeNull()
  })

  it('null, якщо наступний випадок вийшов би за end_date', () => {
    const s = makeSchedule({
      frequency: 'monthly', start_date: '2026-01-01', end_date: '2026-01-01', last_generated_date: '2026-01-01',
    })
    expect(getNextDisplayDate(s)).toBeNull()
  })

  it('null для призупиненого платежу', () => {
    const s = makeSchedule({ is_active: false })
    expect(getNextDisplayDate(s)).toBeNull()
  })
})
