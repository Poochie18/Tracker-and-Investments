import { convertToUahMinorUnits, type ExchangeRates } from '@/lib/investments/exchange-rate'
import { computeDepositTotals } from './deposit-schedule'
import { computeBondTotals, getCurrentYearBondProfitUah } from './bond-schedule'
import { getFiscalYearStartMonth } from '@/lib/settings/fiscal-year'
import { INVESTMENT_TYPE_META } from './types'
import type {
  InvestmentType, LocalBondCouponDate, LocalBondLot, LocalDepositContribution, LocalInvestment, PortfolioSnapshotRow,
} from '@/lib/db/schema'

// ============================================================
// Агрегація портфеля по типу вкладення — той самий принцип, що
// лист "Сводка" в оригінальному Excel користувача: для кожного типу
// (Акції/Крипта/Облігації/Депозит/Інше) рахуємо вкладено, поточну
// вартість, дохід у сумі й %, і частку в загальному портфелі.
//
// Все підсумовується в гривневому базисі (через курс НБУ) — щоб
// активи різних валют (USD-акції, UAH-облігації) можна було звести
// в один портфель. Показ у потрібній валюті — окремим кроком
// (convertFromUahMinorUnits у компоненті).
// ============================================================

export interface TypeSummaryRow {
  type: InvestmentType
  label: string
  colorHex: string
  invested: number // гривневий базис, копійки
  currentValue: number // гривневий базис, копійки
  pnl: number // currentValue - invested
  pnlPercent: number
  portfolioPercent: number // частка currentValue від загального портфеля
}

export interface PortfolioSummary {
  rows: TypeSummaryRow[]
  totalInvested: number
  totalCurrentValue: number
  totalPnl: number
  totalPnlPercent: number
}

// Будує PortfolioSummary з голих сум по типах (invested/currentValue,
// гривневий базис) — спільна логіка для живих даних (обчислюються нижче)
// і збережених зліпків історії (portfolio_snapshots): дохід/% рахуються
// однаково в обох випадках, щоб таблиця/графіки не відрізнялись поведінкою
// залежно від того, дивимось ми поточний стан чи минулий рік.
export function buildPortfolioSummaryFromAmounts(amounts: PortfolioSnapshotRow[]): PortfolioSummary {
  const totalInvested = amounts.reduce((sum, a) => sum + a.invested, 0)
  const totalCurrentValue = amounts.reduce((sum, a) => sum + a.currentValue, 0)

  const rows: TypeSummaryRow[] = amounts
    .map(({ type, invested, currentValue }) => {
      const pnl = currentValue - invested
      return {
        type,
        label: INVESTMENT_TYPE_META[type].label,
        colorHex: INVESTMENT_TYPE_META[type].colorHex,
        invested,
        currentValue,
        pnl,
        pnlPercent: invested === 0 ? 0 : (pnl / invested) * 100,
        portfolioPercent: totalCurrentValue === 0 ? 0 : (currentValue / totalCurrentValue) * 100,
      }
    })
    .sort((a, b) => b.currentValue - a.currentValue)

  const totalPnl = totalCurrentValue - totalInvested
  const totalPnlPercent = totalInvested === 0 ? 0 : (totalPnl / totalInvested) * 100

  return { rows, totalInvested, totalCurrentValue, totalPnl, totalPnlPercent }
}

export function computePortfolioSummary(
  investments: LocalInvestment[],
  rates: ExchangeRates,
  depositContributions: LocalDepositContribution[] = [],
  bondCouponDates: LocalBondCouponDate[] = [],
  bondLots: LocalBondLot[] = [],
  fiscalYearStartMonth: number = getFiscalYearStartMonth()
): PortfolioSummary {
  const byType = new Map<InvestmentType, { invested: number; currentValue: number }>()

  const contributionsByInvestment = new Map<string, LocalDepositContribution[]>()
  for (const c of depositContributions) {
    const list = contributionsByInvestment.get(c.investment_id) ?? []
    list.push(c)
    contributionsByInvestment.set(c.investment_id, list)
  }

  const couponDatesByInvestment = new Map<string, LocalBondCouponDate[]>()
  for (const d of bondCouponDates) {
    const list = couponDatesByInvestment.get(d.investment_id) ?? []
    list.push(d)
    couponDatesByInvestment.set(d.investment_id, list)
  }

  const lotsByInvestment = new Map<string, LocalBondLot[]>()
  for (const l of bondLots) {
    const list = lotsByInvestment.get(l.investment_id) ?? []
    list.push(l)
    lotsByInvestment.set(l.investment_id, list)
  }

  for (const inv of investments) {
    // Для депозиту "вкладено" — початковий внесок + усі поповнення за строк,
    // а "поточна вартість" — сума на кінець останнього місяця строку
    // (внесок + поповнення + всі нараховані відсотки за податком).
    // Для облігації "поточна вартість" — вкладено + всі купонні виплати
    // за весь строк (прибуток облігації = сума купонів, номінал при
    // погашенні — це повернення вкладеного, не дохід).
    let investedRaw: number
    let currentRaw: number
    if (inv.type === 'deposit') {
      const totals = computeDepositTotals(inv, contributionsByInvestment.get(inv.id) ?? [])
      investedRaw = totals.invested
      currentRaw = totals.currentValue
    } else if (inv.type === 'bond') {
      const totals = computeBondTotals(inv, couponDatesByInvestment.get(inv.id) ?? [], lotsByInvestment.get(inv.id) ?? [])
      investedRaw = totals.invested
      currentRaw = totals.currentValue
    } else {
      // Без Math.round тут — покладаємось на округлення вже в
      // convertToUahMinorUnits нижче. Округлення саме тут (до дробової
      // копійки в нативній валюті) для крипти (NUMERIC price) не потрібне
      // й лише додає ще одну точку накопичення похибки при сумуванні
      // десятків монет.
      investedRaw = inv.purchase_price * inv.quantity
      currentRaw = inv.current_price * inv.quantity
    }

    const investedUah = convertToUahMinorUnits(investedRaw, inv.currency, rates)
    const currentUah = convertToUahMinorUnits(currentRaw, inv.currency, rates)

    const prev = byType.get(inv.type) ?? { invested: 0, currentValue: 0 }
    byType.set(inv.type, {
      invested: prev.invested + investedUah,
      currentValue: prev.currentValue + currentUah,
    })
  }

  const amounts: PortfolioSnapshotRow[] = Array.from(byType.entries()).map(([type, v]) => ({ type, ...v }))
  const summary = buildPortfolioSummaryFromAmounts(amounts)

  // Облігації показують дохід окремо від інших типів: не прибуток за
  // весь строк володіння (він включає ще не отримані майбутні купони),
  // а лише за поточний фінансовий рік — щоб "Огляд" відповідав на
  // питання "скільки я заробив/втратив цього року", а не "скільки
  // всього заробить ця облігація за весь час до погашення". Актуально
  // тільки для живих даних — зліпок історії вже "заморожений".
  const bonds = investments.filter((inv) => inv.type === 'bond')
  if (bonds.length === 0) return summary

  const currentYearBondProfitUah = getCurrentYearBondProfitUah(bonds, couponDatesByInvestment, lotsByInvestment, fiscalYearStartMonth, rates)

  const rows = summary.rows.map((row) => {
    if (row.type !== 'bond') return row
    const pnl = currentYearBondProfitUah
    return { ...row, pnl, pnlPercent: row.invested === 0 ? 0 : (pnl / row.invested) * 100 }
  })
  const totalPnl = rows.reduce((sum, r) => sum + r.pnl, 0)
  const totalPnlPercent = summary.totalInvested === 0 ? 0 : (totalPnl / summary.totalInvested) * 100

  return { ...summary, rows, totalPnl, totalPnlPercent }
}
