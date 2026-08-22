import { Money } from '@/lib/utils/money'
import { formatPercent } from '@/lib/utils/format'

interface PortfolioSummaryCardProps {
  invested: Money
  currentValue: Money
  pnl: Money       // currentValue - invested
  pnlPercent: number
}

// Картка зверху екрану інвестицій: скільки вкладено, скільки зараз коштує,
// прибуток/збиток у сумі та відсотках.
export function PortfolioSummaryCard({ invested, currentValue, pnl, pnlPercent }: PortfolioSummaryCardProps) {
  const isProfit = pnl.isPositive() || pnl.isZero()
  const pnlColor = isProfit ? 'var(--color-income)' : 'var(--color-expense)'

  return (
    <div
      className="mx-4 p-5 rounded-3xl flex flex-col gap-4"
      style={{ backgroundColor: 'var(--color-bg-card)' }}
    >
      <div>
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
          Поточна вартість портфеля
        </p>
        <p className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          {currentValue.formatCompact()}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            Вкладено
          </p>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {invested.formatCompact()}
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            Прибуток / збиток
          </p>
          <p className="text-sm font-semibold" style={{ color: pnlColor }}>
            {isProfit ? '+' : ''}{pnl.formatCompact()} ({isProfit ? '+' : ''}{formatPercent(pnlPercent, 1)})
          </p>
        </div>
      </div>
    </div>
  )
}
