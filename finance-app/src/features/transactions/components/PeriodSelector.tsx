import { useState } from 'react'
import { format } from 'date-fns'
import type { PeriodType } from '@/stores/ui-store'
import { useUIStore } from '@/stores/ui-store'

const QUICK_PERIODS: { key: Exclude<PeriodType, 'custom'>; label: string }[] = [
  { key: 'day', label: 'День' },
  { key: 'week', label: 'Тиждень' },
  { key: 'month', label: 'Місяць' },
  { key: 'year', label: 'Рік' },
]

interface PeriodSelectorProps {
  active: PeriodType
  onChange: (period: PeriodType) => void
}

export function PeriodSelector({ active, onChange }: PeriodSelectorProps) {
  const { customFrom, customTo, setCustomRange } = useUIStore()
  const [showCustom, setShowCustom] = useState(active === 'custom')

  // Форматуємо дату у YYYY-MM-DD для <input type="date">
  const toInputVal = (d: Date | null) =>
    d ? format(d, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')

  const handleCustomFrom = (val: string) => {
    if (!val) return
    const from = new Date(val)
    const to = customTo ?? from
    setCustomRange(from, to >= from ? to : from)
  }

  const handleCustomTo = (val: string) => {
    if (!val) return
    const to = new Date(val)
    const from = customFrom ?? to
    setCustomRange(from <= to ? from : to, to)
  }

  return (
    <div className="px-4 py-2 flex flex-col gap-2">
      <div className="flex gap-1">
        {QUICK_PERIODS.map(({ key, label }) => {
          const isActive = active === key
          return (
            <button
              key={key}
              onClick={() => {
                onChange(key)
                setShowCustom(false)
              }}
              className="flex-1 py-1.5 text-xs rounded-lg font-medium transition-all"
              style={{
                backgroundColor: isActive ? 'var(--color-accent)' : 'transparent',
                color: isActive ? '#1B2A2A' : 'var(--color-text-secondary)',
              }}
            >
              {label}
            </button>
          )
        })}
        <button
          onClick={() => {
            setShowCustom(!showCustom)
            if (!showCustom) {
              // При першому відкритті — якщо ще немає custom range, не міняємо period
              // Якщо вже є custom range — встановлюємо
              if (customFrom && customTo) onChange('custom')
            }
          }}
          className="flex-1 py-1.5 text-xs rounded-lg font-medium transition-all"
          style={{
            backgroundColor: active === 'custom' ? 'var(--color-accent)' : 'transparent',
            color: active === 'custom' ? '#1B2A2A' : 'var(--color-text-secondary)',
          }}
        >
          Період
        </button>
      </div>

      <label className="flex items-center gap-2 px-1 py-0.5 text-xs cursor-pointer select-none w-fit">
        <input
          type="checkbox"
          checked={active === 'all'}
          onChange={(e) => {
            setShowCustom(false)
            onChange(e.target.checked ? 'all' : 'month')
          }}
          className="w-3.5 h-3.5 rounded accent-[var(--color-accent)]"
        />
        <span style={{ color: 'var(--color-text-secondary)' }}>Весь час</span>
      </label>

      {/* Кастомний діапазон дат */}
      {showCustom && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ backgroundColor: 'var(--color-bg-card)' }}
        >
          <input
            type="date"
            value={toInputVal(customFrom)}
            max={toInputVal(customTo)}
            onChange={(e) => handleCustomFrom(e.target.value)}
            className="flex-1 text-xs bg-transparent outline-none"
            style={{ color: 'var(--color-text-primary)', colorScheme: 'dark' }}
          />
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>—</span>
          <input
            type="date"
            value={toInputVal(customTo)}
            min={toInputVal(customFrom)}
            onChange={(e) => handleCustomTo(e.target.value)}
            className="flex-1 text-xs bg-transparent outline-none"
            style={{ color: 'var(--color-text-primary)', colorScheme: 'dark' }}
          />
          <button
            onClick={() => {
              if (customFrom && customTo) onChange('custom')
              setShowCustom(false)
            }}
            className="px-3 py-1 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: 'var(--color-accent)', color: '#1B2A2A' }}
          >
            OK
          </button>
        </div>
      )}
    </div>
  )
}
