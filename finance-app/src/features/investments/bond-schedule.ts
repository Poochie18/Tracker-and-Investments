import { convertToUahMinorUnits, type ExchangeRates } from '@/lib/investments/exchange-rate'
import { getFiscalYear, getCurrentFiscalYear, type FiscalYear } from '@/lib/settings/fiscal-year'
import type { LocalBondCouponDate, LocalInvestment } from '@/lib/db/schema'

// ============================================================
// Облігації: дати купонних виплат вводяться вручну зі зведення емітента
// (лист "Облігації" Excel), окремо — явна дата погашення (investment.
// redemption_date). Вони НЕ виводяться одна з одної, бо не завжди
// збігаються (буває купон окремо від дати повернення номіналу).
// ============================================================

export interface BondPaymentRow {
  date: string          // ISO 8601 (дата)
  isCoupon: boolean      // несе купонну виплату (investment.coupon_amount)
  isRedemption: boolean  // це дата погашення (повернення номіналу)
  isPast: boolean        // дата вже минула відносно asOf
}

// Список рядків для відображення графіка виплат: дати купонів + окремо
// дата погашення, злиті в один відсортований список (якщо купон і
// погашення випадають на один день — один рядок з обома позначками).
export function getBondPaymentSchedule(
  dates: LocalBondCouponDate[],
  redemptionDate: string | null,
  asOf: Date = new Date()
): BondPaymentRow[] {
  const rowByDate = new Map<string, { isCoupon: boolean; isRedemption: boolean }>()

  for (const d of dates) {
    const key = d.payment_date.slice(0, 10)
    const prev = rowByDate.get(key) ?? { isCoupon: false, isRedemption: false }
    rowByDate.set(key, { ...prev, isCoupon: true })
  }
  if (redemptionDate) {
    const key = redemptionDate.slice(0, 10)
    const prev = rowByDate.get(key) ?? { isCoupon: false, isRedemption: false }
    rowByDate.set(key, { ...prev, isRedemption: true })
  }

  const asOfIso = asOf.toISOString().slice(0, 10)

  return Array.from(rowByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, flags]) => ({ date, ...flags, isPast: date < asOfIso }))
}

export interface BondTotals {
  invested: number          // копійки: витрачено на купівлю (ціна × кількість)
  redemptionAmount: number  // копійки: сума погашення (номінал) на дату погашення
  totalCoupons: number      // копійки: сума всіх купонних виплат за весь строк
  currentValue: number      // копійки: redemptionAmount + totalCoupons
  profit: number            // копійки: currentValue - invested
}

// Сума погашення (номінал) — вводиться вручну ЗА ОДНУ ШТУКУ, як і ціна
// купівлі, і множиться на кількість (може відрізнятись від суми купівлі:
// облігація куплена з премією/дисконтом до номіналу). Якщо не вказана —
// беремо ціну купівлі за штуку (типова поведінка, коли премії/дисконту немає).
export function getBondRedemptionAmount(investment: LocalInvestment): number {
  const perUnit = investment.redemption_amount ?? investment.purchase_price
  return Math.round(perUnit * investment.quantity)
}

// Сума однієї купонної виплати на всю позицію — investment.coupon_amount
// вводиться ЗА ОДНУ ШТУКУ (як і ціна купівлі), тому множимо на кількість.
export function getBondCouponPaymentAmount(investment: LocalInvestment): number {
  return Math.round((investment.coupon_amount ?? 0) * investment.quantity)
}

// Прибуток облігації = (сума погашення + всі купонні виплати за весь строк)
// − сума купівлі. Кожна дата у списку, включно з датою погашення, несе одну
// купонну виплату по investment.coupon_amount × кількість.
export function computeBondTotals(
  investment: LocalInvestment,
  dates: LocalBondCouponDate[]
): BondTotals {
  const invested = Math.round(investment.purchase_price * investment.quantity)
  const redemptionAmount = getBondRedemptionAmount(investment)
  const totalCoupons = getBondCouponPaymentAmount(investment) * dates.length
  const currentValue = redemptionAmount + totalCoupons
  return { invested, redemptionAmount, totalCoupons, currentValue, profit: currentValue - invested }
}

export interface BondYearProfit {
  year: FiscalYear
  profit: number // копійки, у валюті облігації
}

// Розбивка прибутку облігації по фінансових роках (лист "АНАЛІЗ ПО
// ФІНАНСОВИХ РОКАХ" оригінального Excel) — кожна купонна виплата йде
// у рік своєї дати; різниця (сума погашення − сума купівлі), тобто
// прибуток/збиток від премії чи дисконту до номіналу, йде цілком у рік
// дати погашення. Сума по всіх роках дорівнює computeBondTotals().profit.
export function computeBondProfitByYear(
  investment: LocalInvestment,
  dates: LocalBondCouponDate[],
  fiscalYearStartMonth: number
): BondYearProfit[] {
  const byKey = new Map<string, BondYearProfit>()
  const couponPayment = getBondCouponPaymentAmount(investment)

  const addProfit = (date: Date, amount: number) => {
    const year = getFiscalYear(date, fiscalYearStartMonth)
    const prev = byKey.get(year.key)
    byKey.set(year.key, { year, profit: (prev?.profit ?? 0) + amount })
  }

  for (const d of dates) {
    addProfit(new Date(d.payment_date), couponPayment)
  }

  if (investment.redemption_date) {
    const invested = Math.round(investment.purchase_price * investment.quantity)
    const capitalGain = getBondRedemptionAmount(investment) - invested
    addProfit(new Date(investment.redemption_date), capitalGain)
  }

  return Array.from(byKey.values()).sort(
    (a, b) => a.year.startDate.getTime() - b.year.startDate.getTime()
  )
}

// Прибуток по всіх облігаціях, згрупований по фінансових роках і
// зведений у гривневий базис (як portfolio-summary.ts) — для таблиці
// "Прибуток по роках" на вкладці "Облігації" та фільтру поточного року
// на "Огляді".
export function aggregateBondProfitByYear(
  bonds: LocalInvestment[],
  couponDatesByInvestment: Map<string, LocalBondCouponDate[]>,
  fiscalYearStartMonth: number,
  rates: ExchangeRates
): BondYearProfit[] {
  const byKey = new Map<string, BondYearProfit>()

  for (const bond of bonds) {
    const dates = couponDatesByInvestment.get(bond.id) ?? []
    for (const { year, profit } of computeBondProfitByYear(bond, dates, fiscalYearStartMonth)) {
      const profitUah = convertToUahMinorUnits(profit, bond.currency, rates)
      const prev = byKey.get(year.key)
      byKey.set(year.key, { year, profit: (prev?.profit ?? 0) + profitUah })
    }
  }

  return Array.from(byKey.values()).sort(
    (a, b) => a.year.startDate.getTime() - b.year.startDate.getTime()
  )
}

// Прибуток по облігаціях за поточний фінансовий рік (у гривневому
// базисі) — саме це число показується на "Огляді", а не прибуток за
// весь строк, як для інших типів активів.
export function getCurrentYearBondProfitUah(
  bonds: LocalInvestment[],
  couponDatesByInvestment: Map<string, LocalBondCouponDate[]>,
  fiscalYearStartMonth: number,
  rates: ExchangeRates
): number {
  const currentKey = getCurrentFiscalYear(fiscalYearStartMonth).key
  const byYear = aggregateBondProfitByYear(bonds, couponDatesByInvestment, fiscalYearStartMonth, rates)
  return byYear.find((y) => y.year.key === currentKey)?.profit ?? 0
}
