import { useState } from 'react'
import { Money } from '@/lib/utils/money'

interface DepositContributionSheetProps {
  monthIndex: number
  monthLabel: string
  currentAmount: number // копійки, 0 якщо ще не введено
  currency: string
  isSaving: boolean
  onSave: (amountUnits: number) => void
  onClose: () => void
}

const CURRENCY_SYMBOLS: Record<string, string> = { UAH: '₴', USD: '$', EUR: '€' }

// Bottom-sheet для введення/редагування поповнення депозиту за конкретний місяць.
export function DepositContributionSheet({
  monthIndex,
  monthLabel,
  currentAmount,
  currency,
  isSaving,
  onSave,
  onClose,
}: DepositContributionSheetProps) {
  const [value, setValue] = useState(currentAmount > 0 ? String(currentAmount / 100) : '')
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency

  const handleSave = () => {
    const amount = parseFloat(value.replace(',', '.'))
    onSave(isNaN(amount) || amount < 0 ? 0 : amount)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-t-3xl p-6 pb-10 flex flex-col gap-4"
        style={{ backgroundColor: 'var(--color-bg-card)' }}
      >
        <p className="text-base font-semibold text-center" style={{ color: 'var(--color-text-primary)' }}>
          Поповнення за {monthLabel} (місяць {monthIndex})
        </p>

        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Сума поповнення ({symbol})
          </p>
          <input
            autoFocus
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^0-9.,]/g, ''))}
            className="w-full text-2xl font-bold bg-transparent border-none outline-none"
            style={{ color: 'var(--color-text-primary)' }}
          />
          <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 8 }} />
          {currentAmount > 0 && (
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
              Поточне значення: {Money.fromKopiyky(currentAmount).formatCompact(symbol)}
            </p>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-3 rounded-2xl font-semibold text-sm disabled:opacity-60"
          style={{ backgroundColor: 'var(--color-accent)', color: '#1B2A2A' }}
        >
          {isSaving ? 'Зберігаємо...' : 'Зберегти'}
        </button>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl font-semibold text-sm"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-text-primary)' }}
        >
          Скасувати
        </button>
      </div>
    </div>
  )
}
