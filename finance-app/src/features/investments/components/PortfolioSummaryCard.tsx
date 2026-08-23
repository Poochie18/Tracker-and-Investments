import { Money } from '@/lib/utils/money'
import { formatPercent } from '@/lib/utils/format'

interface PortfolioSummaryCardProps {
  invested: Money
  currentValue: Money
  pnl: Money       // currentValue - invested
  pnlPercent: number
  // Вкладено/Прибуток одне під одним замість пліч-о-пліч — для вузької
  // колонки, коли картка стоїть поруч з іншою (напр. таблицею по роках
  // на вкладці "Облігації").
  stacked?: boolean
  // Класи контейнера — типово 'mx-4' (картка на всю ширину екрана);
  // передай свій, коли картка вкладена в ряд (напр. 'flex-1').
  className?: string
}

// Картка зверху екрану інвестицій: скільки вкладено, скільки зараз коштує,
// прибуток/збиток у сумі та відсотках.
export function PortfolioSummaryCard({
  invested,
  currentValue,
  pnl,
  pnlPercent,
  stacked,
  className = 'mx-4',
}: PortfolioSummaryCardProps) {
  const isProfit = pnl.isPositive() || pnl.isZero()
  const pnlColor = isProfit ? 'var(--color-income)' : 'var(--color-expense)'

  return (
    <div
      className={`${className} ${stacked ? 'p-4' : 'p-5'} rounded-3xl flex flex-col gap-4 min-w-0`}
      style={{ backgroundColor: 'var(--color-bg-card)' }}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
          Поточна вартість портфеля
        </p>
        <p className={`${stacked ? 'text-xl' : 'text-3xl'} font-bold truncate`} style={{ color: 'var(--color-text-primary)' }}>
          {currentValue.formatCompact()}
        </p>
      </div>

      <div className={stacked ? 'flex flex-col gap-3' : 'flex items-center justify-between'}>
        <div>
          <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            Вкладено
          </p>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {invested.formatCompact()}
          </p>
        </div>

        <div className={stacked ? '' : 'text-right'}>
          <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {stacked ? 'Прибуток' : 'Прибуток / збиток'}
          </p>
          <p className="text-sm font-semibold" style={{ color: pnlColor }}>
            {isProfit ? '+' : ''}{pnl.formatCompact()} ({isProfit ? '+' : ''}{formatPercent(pnlPercent, 1)})
          </p>
        </div>
      </div>
    </div>
  )
}
