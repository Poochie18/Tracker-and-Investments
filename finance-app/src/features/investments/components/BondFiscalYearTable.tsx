import { Money } from '@/lib/utils/money'
import { getCurrentFiscalYear } from '@/lib/settings/fiscal-year'
import { aggregateBondProfitByYear } from '../bond-schedule'
import type { ExchangeRates } from '@/lib/investments/exchange-rate'
import type { LocalBondCouponDate, LocalBondLot, LocalInvestment } from '@/lib/db/schema'

interface BondFiscalYearTableProps {
  bonds: LocalInvestment[]
  bondCouponDates: LocalBondCouponDate[]
  bondLots: LocalBondLot[]
  rates: ExchangeRates
  fiscalYearStartMonth: number
}

// Невелика таблиця зверху вкладки "Облігації" — прибуток/збиток по
// кожному фінансовому року (аналог листа "АНАЛІЗ ПО ФІНАНСОВИХ РОКАХ"
// з Excel). Купонні виплати йдуть у рік своєї дати; різниця між сумою
// погашення і сумою купівлі — у рік дати погашення. Суми зведені в
// гривню, щоб облігації різних валют можна було показати в одній таблиці.
export function BondFiscalYearTable({ bonds, bondCouponDates, bondLots, rates, fiscalYearStartMonth }: BondFiscalYearTableProps) {
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

  const byYear = aggregateBondProfitByYear(bonds, couponDatesByInvestment, lotsByInvestment, fiscalYearStartMonth, rates)
  if (byYear.length === 0) return null

  const currentYearKey = getCurrentFiscalYear(fiscalYearStartMonth).key

  return (
    <div className="min-w-0">
      <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
        Прибуток по роках
      </p>
      <div className="flex flex-col gap-1.5">
        {byYear.map(({ year, profit }) => {
          const isProfit = profit >= 0
          const isCurrent = year.key === currentYearKey
          return (
            <div key={year.key} className="flex flex-col">
              <p className="text-[11px] leading-tight" style={{ color: 'var(--color-text-secondary)' }}>
                {year.label}
                {isCurrent && <span style={{ color: 'var(--color-accent)' }}> •</span>}
              </p>
              <p
                className="text-xs font-medium leading-tight"
                style={{ color: isProfit ? 'var(--color-income)' : 'var(--color-expense)' }}
              >
                {isProfit ? '+' : ''}{Money.fromKopiyky(profit).formatWhole('₴')}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
