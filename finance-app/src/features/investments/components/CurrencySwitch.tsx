export type DisplayCurrency = 'UAH' | 'USD'

interface CurrencySwitchProps {
  active: DisplayCurrency
  onChange: (currency: DisplayCurrency) => void
}

// Перемикач валюти відображення портфеля — той самий стиль сегмент-контролу,
// що ExpenseIncomeTabs, тільки для UAH/USD.
export function CurrencySwitch({ active, onChange }: CurrencySwitchProps) {
  return (
    <div className="flex rounded-xl p-1" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
      {(['UAH', 'USD'] as const).map((cur) => {
        const isActive = active === cur
        return (
          <button
            key={cur}
            onClick={() => onChange(cur)}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg transition-all"
            style={{
              backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            }}
          >
            {cur === 'UAH' ? '₴ UAH' : '$ USD'}
          </button>
        )
      })}
    </div>
  )
}
