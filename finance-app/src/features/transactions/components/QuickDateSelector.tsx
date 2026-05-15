import { format } from 'date-fns'
import { QUICK_DATES } from '@/lib/utils/dates'

interface QuickDateSelectorProps {
  value: Date
  onChange: (date: Date) => void
}

export function QuickDateSelector({ value, onChange }: QuickDateSelectorProps) {
  const today = new Date()

  // Перевіряємо чи вибрана дата співпадає з однією з quick-кнопок
  const getActiveQuick = () => {
    const valueDay = format(value, 'yyyy-MM-dd')
    for (const q of QUICK_DATES) {
      if (format(q.getDate(), 'yyyy-MM-dd') === valueDay) return q.label
    }
    return null
  }

  const activeQuick = getActiveQuick()

  return (
    <div className="flex flex-col gap-2 px-4">
      <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        Дата
      </p>
      <div className="flex gap-2">
        {QUICK_DATES.map((q) => {
          const isActive = activeQuick === q.label
          return (
            <button
              key={q.label}
              type="button"
              onClick={() => onChange(q.getDate())}
              className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{
                backgroundColor: isActive ? 'var(--color-accent)' : 'rgba(255,255,255,0.08)',
                color: isActive ? '#1B2A2A' : 'var(--color-text-secondary)',
              }}
            >
              {q.label}
            </button>
          )
        })}

        {/* Поле вибору дати з календаря */}
        <input
          type="date"
          value={format(value, 'yyyy-MM-dd')}
          max={format(today, 'yyyy-MM-dd')}
          onChange={(e) => {
            if (e.target.value) onChange(new Date(e.target.value + 'T12:00:00'))
          }}
          className="flex-1 px-2 py-1.5 rounded-xl text-xs text-center"
          style={{
            backgroundColor: activeQuick ? 'rgba(255,255,255,0.08)' : 'var(--color-accent)',
            color: activeQuick ? 'var(--color-text-secondary)' : '#1B2A2A',
            border: 'none',
            colorScheme: 'dark',
          }}
        />
      </div>
    </div>
  )
}
