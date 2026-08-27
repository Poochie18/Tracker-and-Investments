import { convertToUahMinorUnits, type ExchangeRates } from '@/lib/investments/exchange-rate'
import { getFiscalYear, getCurrentFiscalYear, type FiscalYear } from '@/lib/settings/fiscal-year'
import type { LocalBondCouponDate, LocalBondLot, LocalInvestment } from '@/lib/db/schema'

// ============================================================
// Облігації: дати купонних виплат вводяться вручну зі зведення емітента
// (лист "Облігації" Excel), окремо — явна дата погашення (investment.
// redemption_date). Вони НЕ виводяться одна з одної, бо не завжди
// збігаються (буває купон окремо від дати повернення номіналу).
//
// Кількість "на руках" на конкретну дату НЕ дорівнює investment.quantity
// (це поточна сумарна кількість) — облігації купуються партіями (лотами)
// в різні дати (bond_lots), і купонна виплата на дату Х має рахуватись по
// кількості, яка фактично була куплена ДО цієї дати, а не по сумарній
// кількості "на сьогодні". Інакше докупівля заднім числом "переписувала" б
// уже минулі виплати.
// ============================================================

// Сума кількостей активних лотів, куплених не пізніше asOfDateIso.
export function getOutstandingQuantity(lots: LocalBondLot[], asOfDateIso: string): number {
  const asOfKey = asOfDateIso.slice(0, 10)
  return lots
    .filter((l) => l.purchase_date.slice(0, 10) <= asOfKey)
    .reduce((sum, l) => sum + l.quantity, 0)
}

// Загальна кількість по всіх активних лотах (= investment.quantity, якщо
// воно вже синхронізоване bond-lots-repo.ts).
export function getTotalLotQuantity(lots: LocalBondLot[]): number {
  return lots.reduce((sum, l) => sum + l.quantity, 0)
}

export interface BondPaymentRow {
  date: string          // ISO 8601 (дата)
  isCoupon: boolean      // несе купонну виплату
  isRedemption: boolean  // це дата погашення (повернення номіналу)
  isPast: boolean        // дата вже минула відносно asOf
  amount: number         // копійки — сума виплати на цю дату (купон за кількість "на руках" + погашення)
}

// Список рядків для відображення графіка виплат: дати купонів + окремо
// дата погашення, злиті в один відсортований список (якщо купон і
// погашення випадають на один день — один рядок з обома позначками).
// Сума купона на кожну дату рахується по кількості лотів, куплених ДО
// цієї дати (getOutstandingQuantity) — а не по поточній сумарній кількості.
export function getBondPaymentSchedule(
  dates: LocalBondCouponDate[],
  redemptionDate: string | null,
  lots: LocalBondLot[],
  couponAmountPerUnit: number | null,
  redemptionAmountPerUnit: number,
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
  const totalQuantity = getTotalLotQuantity(lots)

  return Array.from(rowByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, flags]) => {
      const couponPart = flags.isCoupon
        ? Math.round((couponAmountPerUnit ?? 0) * getOutstandingQuantity(lots, date))
        : 0
      const redemptionPart = flags.isRedemption ? Math.round(redemptionAmountPerUnit * totalQuantity) : 0
      return { date, ...flags, isPast: date < asOfIso, amount: couponPart + redemptionPart }
    })
}

export interface BondTotals {
  invested: number          // копійки: сума всіх лотів (кількість × ціна саме цього лота)
  redemptionAmount: number  // копійки: сума погашення (номінал) на дату погашення
  totalCoupons: number      // копійки: сума всіх купонних виплат за весь строк
  currentValue: number      // копійки: redemptionAmount + totalCoupons
  profit: number            // копійки: currentValue - invested
}

// Сума погашення (номінал) — вводиться вручну ЗА ОДНУ ШТУКУ (як і ціна
// купівлі), і множиться на ЗАГАЛЬНУ кількість (сума всіх лотів). Якщо не
// вказана — беремо ціну купівлі (перший лот) за штуку.
export function getBondRedemptionAmount(investment: LocalInvestment, lots: LocalBondLot[]): number {
  const perUnit = investment.redemption_amount ?? investment.purchase_price
  return Math.round(perUnit * getTotalLotQuantity(lots))
}

// Сума однієї купонної виплати на дату date — investment.coupon_amount
// вводиться ЗА ОДНУ ШТУКУ, множиться на кількість, що фактично була "на
// руках" на цю дату (а не на поточну сумарну кількість).
export function getBondCouponPaymentAmount(
  investment: LocalInvestment,
  lots: LocalBondLot[],
  onDateIso: string
): number {
  return Math.round((investment.coupon_amount ?? 0) * getOutstandingQuantity(lots, onDateIso))
}

// Сума вкладеного — по кожному лоту окремо (кількість × ціна саме цього
// лота), а не investment.quantity × investment.purchase_price (той
// відображає лише перший лот).
function getInvestedAmount(lots: LocalBondLot[]): number {
  return lots.reduce((sum, l) => sum + Math.round(l.quantity * l.purchase_price), 0)
}

// Прибуток облігації = (сума погашення + всі купонні виплати за весь строк)
// − сума вкладеного. Кожна дата у списку купонів несе виплату по кількості,
// що була "на руках" на цю дату; дата погашення — по повній кількості.
export function computeBondTotals(
  investment: LocalInvestment,
  dates: LocalBondCouponDate[],
  lots: LocalBondLot[]
): BondTotals {
  const invested = getInvestedAmount(lots)
  const redemptionAmount = getBondRedemptionAmount(investment, lots)
  const totalCoupons = dates.reduce(
    (sum, d) => sum + getBondCouponPaymentAmount(investment, lots, d.payment_date),
    0
  )
  const currentValue = redemptionAmount + totalCoupons
  return { invested, redemptionAmount, totalCoupons, currentValue, profit: currentValue - invested }
}

export interface BondYearProfit {
  year: FiscalYear
  profit: number // копійки, у валюті облігації
}

// Розбивка прибутку облігації по фінансових роках (лист "АНАЛІЗ ПО
// ФІНАНСОВИХ РОКАХ" оригінального Excel) — кожна купонна виплата йде
// у рік своєї дати (по кількості "на руках" на цю дату); різниця (сума
// погашення − сума вкладеного), тобто прибуток/збиток від премії чи
// дисконту до номіналу, йде цілком у рік дати погашення. Сума по всіх
// роках дорівнює computeBondTotals().profit.
export function computeBondProfitByYear(
  investment: LocalInvestment,
  dates: LocalBondCouponDate[],
  lots: LocalBondLot[],
  fiscalYearStartMonth: number
): BondYearProfit[] {
  const byKey = new Map<string, BondYearProfit>()

  const addProfit = (date: Date, amount: number) => {
    const year = getFiscalYear(date, fiscalYearStartMonth)
    const prev = byKey.get(year.key)
    byKey.set(year.key, { year, profit: (prev?.profit ?? 0) + amount })
  }

  for (const d of dates) {
    addProfit(new Date(d.payment_date), getBondCouponPaymentAmount(investment, lots, d.payment_date))
  }

  if (investment.redemption_date) {
    const invested = getInvestedAmount(lots)
    const capitalGain = getBondRedemptionAmount(investment, lots) - invested
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
  lotsByInvestment: Map<string, LocalBondLot[]>,
  fiscalYearStartMonth: number,
  rates: ExchangeRates
): BondYearProfit[] {
  const byKey = new Map<string, BondYearProfit>()

  for (const bond of bonds) {
    const dates = couponDatesByInvestment.get(bond.id) ?? []
    const lots = lotsByInvestment.get(bond.id) ?? []
    for (const { year, profit } of computeBondProfitByYear(bond, dates, lots, fiscalYearStartMonth)) {
      const profitUah = convertToUahMinorUnits(profit, bond.currency, rates)
      const prev = byKey.get(year.key)
      byKey.set(year.key, { year, profit: (prev?.profit ?? 0) + profitUah })
    }
  }

  return Array.from(byKey.values()).sort(
    (a, b) => a.year.startDate.getTime() - b.year.startDate.getTime()
  )
}

export interface NextBondPayment {
  investmentName: string
  date: string      // ISO 8601 (дата)
  amount: number     // копійки, у валюті облігації
  currency: string
}

// Найближча ще не минула виплата (купон і/або погашення) по одній
// облігації — перший рядок графіка з isPast === false.
export function getNextBondPayment(
  investment: LocalInvestment,
  dates: LocalBondCouponDate[],
  lots: LocalBondLot[],
  asOf: Date = new Date()
): NextBondPayment | null {
  const rows = getBondPaymentSchedule(
    dates,
    investment.redemption_date,
    lots,
    investment.coupon_amount,
    investment.redemption_amount ?? investment.purchase_price,
    asOf
  )
  const next = rows.find((r) => !r.isPast)
  if (!next) return null
  return { investmentName: investment.name, date: next.date, amount: next.amount, currency: investment.currency }
}

// Найближча виплата серед УСІХ облігацій портфеля — беремо ту з
// найранішою датою. amountUah — сума, зведена в гривню (як і решта
// агрегованих показників), щоб коректно порівнювати дати різних валют.
export function getNextBondPaymentAcrossPortfolio(
  bonds: LocalInvestment[],
  couponDatesByInvestment: Map<string, LocalBondCouponDate[]>,
  lotsByInvestment: Map<string, LocalBondLot[]>,
  rates: ExchangeRates,
  asOf: Date = new Date()
): (NextBondPayment & { amountUah: number }) | null {
  let best: (NextBondPayment & { amountUah: number }) | null = null

  for (const bond of bonds) {
    const dates = couponDatesByInvestment.get(bond.id) ?? []
    const lots = lotsByInvestment.get(bond.id) ?? []
    const next = getNextBondPayment(bond, dates, lots, asOf)
    if (!next) continue
    if (!best || next.date < best.date) {
      best = { ...next, amountUah: convertToUahMinorUnits(next.amount, next.currency, rates) }
    }
  }

  return best
}

// Прибуток по облігаціях за поточний фінансовий рік (у гривневому
// базисі) — саме це число показується на "Огляді", а не прибуток за
// весь строк, як для інших типів активів.
export function getCurrentYearBondProfitUah(
  bonds: LocalInvestment[],
  couponDatesByInvestment: Map<string, LocalBondCouponDate[]>,
  lotsByInvestment: Map<string, LocalBondLot[]>,
  fiscalYearStartMonth: number,
  rates: ExchangeRates
): number {
  const currentKey = getCurrentFiscalYear(fiscalYearStartMonth).key
  const byYear = aggregateBondProfitByYear(bonds, couponDatesByInvestment, lotsByInvestment, fiscalYearStartMonth, rates)
  return byYear.find((y) => y.year.key === currentKey)?.profit ?? 0
}
