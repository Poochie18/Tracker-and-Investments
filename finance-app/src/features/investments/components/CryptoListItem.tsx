import { CategoryIconCircle } from '@/features/transactions/components/CategoryIconCircle'
import { Money } from '@/lib/utils/money'
import { INVESTMENT_TYPE_META } from '../types'
import type { LocalInvestment } from '@/lib/db/schema'

interface CryptoListItemProps {
  investment: LocalInvestment
}

// Картка криптоактиву — мінімальна: назва, під нею формула "кількість ×
// ціна", праворуч — сама перемножена сума (поточна вартість цієї монети
// в гаманці). Не клікабельна (кількість/ціну веде синк з Binance) і без
// прибутку — той показує вже картка PortfolioSummaryCard зверху вкладки.
export function CryptoListItem({ investment }: CryptoListItemProps) {
  const meta = INVESTMENT_TYPE_META.crypto
  const isSynced = investment.source === 'binance_sync'

  const currentValue = Money.fromKopiyky(Math.round(investment.current_price * investment.quantity))
  const pricePerUnit = (investment.current_price / 100).toLocaleString('uk-UA', { maximumFractionDigits: 6 })

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl w-full"
      style={{ backgroundColor: 'var(--color-bg-card)' }}
    >
      <CategoryIconCircle iconName={meta.iconName} colorHex={meta.colorHex} size="md" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
            {investment.name}
          </p>
          {isSynced && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md flex-shrink-0" style={{ backgroundColor: 'rgba(244,185,66,0.15)', color: '#F4B942' }}>
              з Binance
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
          {investment.quantity} × {pricePerUnit} $
        </p>
      </div>

      <p className="text-sm font-semibold flex-shrink-0" style={{ color: 'var(--color-text-primary)' }}>
        {currentValue.formatCompact('$')}
      </p>
    </div>
  )
}
