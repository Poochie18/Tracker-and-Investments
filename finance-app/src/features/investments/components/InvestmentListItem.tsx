import { CategoryIconCircle } from '@/features/transactions/components/CategoryIconCircle'
import { Money } from '@/lib/utils/money'
import { formatPercent } from '@/lib/utils/format'
import { INVESTMENT_TYPE_META } from '../types'
import type { LocalInvestment } from '@/lib/db/schema'

interface InvestmentListItemProps {
  investment: LocalInvestment
  onPress: () => void
}

// Валютний символ для CSS-класу Money.format — підтримуємо основні валюти,
// решта показуються з ISO-кодом як текстом.
const CURRENCY_SYMBOLS: Record<string, string> = {
  UAH: '₴',
  USD: '$',
  EUR: '€',
}

export function InvestmentListItem({ investment, onPress }: InvestmentListItemProps) {
  const meta = INVESTMENT_TYPE_META[investment.type]
  const symbol = CURRENCY_SYMBOLS[investment.currency] ?? investment.currency

  const invested = Money.fromKopiyky(Math.round(investment.purchase_price * investment.quantity))
  const currentValue = Money.fromKopiyky(Math.round(investment.current_price * investment.quantity))
  const pnl = currentValue.subtract(invested)
  const pnlPercent = invested.isZero() ? 0 : (pnl.toKopiyky() / invested.toKopiyky()) * 100
  const isProfit = pnl.isPositive() || pnl.isZero()

  return (
    <button
      type="button"
      onClick={onPress}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl w-full text-left transition-opacity active:opacity-70"
      style={{ backgroundColor: 'var(--color-bg-card)' }}
    >
      <CategoryIconCircle iconName={meta.iconName} colorHex={meta.colorHex} size="md" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
          {investment.name}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
          {investment.quantity} × {currentValue.isZero() ? '—' : `${(investment.current_price / 100).toLocaleString('uk-UA')} ${symbol}`}
        </p>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {currentValue.formatCompact(symbol)}
        </p>
        <p className="text-xs mt-0.5" style={{ color: isProfit ? 'var(--color-income)' : 'var(--color-expense)' }}>
          {isProfit ? '+' : ''}{formatPercent(pnlPercent, 1)}
        </p>
      </div>
    </button>
  )
}
