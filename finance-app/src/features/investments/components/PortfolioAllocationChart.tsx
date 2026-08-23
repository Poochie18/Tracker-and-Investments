import { Money } from '@/lib/utils/money'
import { convertFromUahMinorUnits, type ExchangeRates } from '@/lib/investments/exchange-rate'
import { DonutChart } from '@/features/transactions/components/DonutChart'
import type { PortfolioSummary } from '../portfolio-summary'
import type { DisplayCurrency } from './CurrencySwitch'

interface PortfolioAllocationChartProps {
  summary: PortfolioSummary
  displayCurrency: DisplayCurrency
  rates: ExchangeRates
}

// Pie-графік: частка кожного типу вкладення в портфелі (за поточною вартістю).
export function PortfolioAllocationChart({ summary, displayCurrency, rates }: PortfolioAllocationChartProps) {
  const symbol = displayCurrency === 'UAH' ? '₴' : '$'
  const totalDisplay = Money.fromKopiyky(
    convertFromUahMinorUnits(summary.totalCurrentValue, displayCurrency, rates)
  ).formatWhole(symbol)

  const data = summary.rows.map((r) => ({ name: r.label, value: r.currentValue, color: r.colorHex }))

  return (
    <div>
      <p className="text-xs font-medium px-4 mb-1" style={{ color: 'var(--color-text-secondary)' }}>
        Розподіл портфеля
      </p>
      <DonutChart data={data} centerLabel={totalDisplay} centerSublabel="портфель" />

      {/* Легенда */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-4 justify-center">
        {summary.rows.map((r) => (
          <div key={r.type} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.colorHex }} />
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {r.label} · {r.portfolioPercent.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
