import { convertToUahMinorUnits, type ExchangeRates } from '@/lib/investments/exchange-rate'
import { INVESTMENT_TYPE_META } from './types'
import type { InvestmentType, LocalInvestment } from '@/lib/db/schema'

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

export function computePortfolioSummary(
  investments: LocalInvestment[],
  rates: ExchangeRates
): PortfolioSummary {
  const byType = new Map<InvestmentType, { invested: number; currentValue: number }>()

  for (const inv of investments) {
    const investedUah = convertToUahMinorUnits(
      Math.round(inv.purchase_price * inv.quantity),
      inv.currency,
      rates
    )
    const currentUah = convertToUahMinorUnits(
      Math.round(inv.current_price * inv.quantity),
      inv.currency,
      rates
    )

    const prev = byType.get(inv.type) ?? { invested: 0, currentValue: 0 }
    byType.set(inv.type, {
      invested: prev.invested + investedUah,
      currentValue: prev.currentValue + currentUah,
    })
  }

  const totalInvested = Array.from(byType.values()).reduce((sum, t) => sum + t.invested, 0)
  const totalCurrentValue = Array.from(byType.values()).reduce((sum, t) => sum + t.currentValue, 0)

  const rows: TypeSummaryRow[] = Array.from(byType.entries())
    .map(([type, { invested, currentValue }]) => {
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
