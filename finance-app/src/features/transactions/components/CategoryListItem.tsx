import { CategoryIconCircle } from './CategoryIconCircle'
import { Money } from '@/lib/utils/money'
import type { LocalCategory } from '@/lib/db/schema'

interface CategoryListItemProps {
  category: LocalCategory
  amount: number    // у копійках
  percentage: number
  onPress?: () => void
}

export function CategoryListItem({ category, amount, percentage, onPress }: CategoryListItemProps) {
  const formatted = Money.fromKopiyky(amount).formatCompact()
  const pct = Math.round(percentage)

  return (
    <button
      onClick={onPress}
      className="flex items-center gap-3 w-full px-4 py-3 active:opacity-70 transition-opacity"
    >
      <CategoryIconCircle iconName={category.icon_name} colorHex={category.color_hex} size="md" />

      <div className="flex-1 text-left">
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          {category.name}
        </p>
        {/* Прогрес-бар відносно загальної суми */}
        <div
          className="mt-1 h-1 rounded-full overflow-hidden"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(pct, 100)}%`,
              backgroundColor: category.color_hex,
            }}
          />
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {formatted}
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          {pct}%
        </p>
      </div>
    </button>
  )
}
