import { describe, it, expect } from 'vitest'
import {
  getOutstandingQuantity,
  getBondCouponPaymentAmount,
  computeBondTotals,
} from '../bond-schedule'
import type { LocalBondCouponDate, LocalBondLot, LocalInvestment } from '@/lib/db/schema'

function makeLot(overrides: Partial<LocalBondLot>): LocalBondLot {
  return {
    id: overrides.id ?? 'lot',
    user_id: 'u1',
    investment_id: 'inv1',
    purchase_date: '2026-01-01',
    quantity: 10,
    purchase_price: 100000, // 1000.00 у валюті, копійки
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    _sync_status: 'synced',
    _sync_error: null,
    _local_updated_at: 0,
    ...overrides,
  }
}

function makeCouponDate(paymentDate: string): LocalBondCouponDate {
  return {
    id: `coupon-${paymentDate}`,
    user_id: 'u1',
    investment_id: 'inv1',
    payment_date: paymentDate,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    _sync_status: 'synced',
    _sync_error: null,
    _local_updated_at: 0,
  }
}

const baseInvestment: LocalInvestment = {
  id: 'inv1',
  user_id: 'u1',
  name: 'Тестова облігація',
  type: 'bond',
  quantity: 10,
  purchase_price: 100000,
  current_price: 100000,
  currency: 'UAH',
  purchase_date: '2026-01-01',
  notes: null,
  interest_rate_percent: null,
  term_months: null,
  coupon_amount: 8175, // 81.75 за 1 шт
  redemption_amount: 100000,
  redemption_date: '2026-12-31',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
  _sync_status: 'synced',
  _sync_error: null,
  _local_updated_at: 0,
}

// Сценарій із ТЗ: 1-го числа куплено 10 шт, 2-го — виплата купона по
// старій кількості (10 шт), 3-го докуплено ще 10 шт (=20), 4-го — виплата
// купона вже по новій сумарній кількості (20 шт).
describe('облігації: докупівля партіями впливає тільки на майбутні купони', () => {
  const lot1 = makeLot({ id: 'lot1', purchase_date: '2026-01-01', quantity: 10 })
  const lot2 = makeLot({ id: 'lot2', purchase_date: '2026-01-03', quantity: 10 })
  const lots = [lot1, lot2]

  it('getOutstandingQuantity рахує тільки лоти, куплені не пізніше дати', () => {
    expect(getOutstandingQuantity(lots, '2026-01-02')).toBe(10)
    expect(getOutstandingQuantity(lots, '2026-01-03')).toBe(20)
    expect(getOutstandingQuantity(lots, '2026-01-04')).toBe(20)
  })

  it('купон 2-го числа (до докупівлі) йде по старій кількості (10 шт)', () => {
    const amount = getBondCouponPaymentAmount(baseInvestment, lots, '2026-01-02')
    expect(amount).toBe(8175 * 10)
  })

  it('купон 4-го числа (після докупівлі) йде по новій сумарній кількості (20 шт)', () => {
    const amount = getBondCouponPaymentAmount(baseInvestment, lots, '2026-01-04')
    expect(amount).toBe(8175 * 20)
  })

  it('computeBondTotals сумує купони по фактичній кількості на кожну дату', () => {
    const dates = [makeCouponDate('2026-01-02'), makeCouponDate('2026-01-04')]
    const totals = computeBondTotals(baseInvestment, dates, lots)

    // Вкладено = 10шт×1000 + 10шт×1000 (обидва лоти по 1000 за штуку)
    expect(totals.invested).toBe(10 * 100000 + 10 * 100000)
    // Купони: 10шт на першу дату + 20шт на другу — НЕ 20+20
    expect(totals.totalCoupons).toBe(8175 * 10 + 8175 * 20)
  })
})
