import { ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'
import { shiftPeriodAnchor, isCurrentPeriod } from '@/lib/utils/dates'
import type { PeriodType } from '@/stores/ui-store'

interface PeriodNavigatorProps {
  period: PeriodType
  anchor: Date
  label: string
  onAnchorChange: (date: Date) => void
}

// Ширина бокових "крил" навколо дати — однакова зліва і справа,
// тому дата завжди залишається точно по центру, незалежно від того,
// показана кнопка "сьогодні" чи ні (вона не штовхає лейбл, а просто
// займає частину вже зарезервованого місця праворуч).
const WING_WIDTH = 56

// Стрілки "‹ попередній / наступний ›" навколо заголовку періоду
// + скромна кнопка "»" (перестрибнути на сьогодні), коли відійшли
// від поточного періоду. Для 'custom' (довільний діапазон) і 'all'
// (весь час) навігація не має сенсу — рендеримо просто заголовок.
export function PeriodNavigator({ period, anchor, label, onAnchorChange }: PeriodNavigatorProps) {
  if (period === 'custom' || period === 'all') {
    return (
      <p className="text-sm font-medium text-center" style={{ color: 'rgba(255,255,255,0.6)' }}>
        {label}
      </p>
    )
  }

  const isCurrent = isCurrentPeriod(period, anchor)

  return (
    <div className="flex items-center justify-center">
      <div className="flex items-center justify-end" style={{ width: WING_WIDTH }}>
        <button
          onClick={() => onAnchorChange(shiftPeriodAnchor(period, anchor, -1))}
          className="p-1 rounded-full active:opacity-60"
          aria-label="Попередній період"
        >
          <ChevronLeft size={18} color="rgba(255,255,255,0.6)" />
        </button>
      </div>

      <p className="text-sm font-medium text-center px-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
        {label}
      </p>

      <div className="flex items-center justify-start" style={{ width: WING_WIDTH }}>
        <button
          onClick={() => onAnchorChange(shiftPeriodAnchor(period, anchor, 1))}
          className="p-1 rounded-full active:opacity-60"
          aria-label="Наступний період"
        >
          <ChevronRight size={18} color="rgba(255,255,255,0.6)" />
        </button>

        {!isCurrent && (
          <button
            onClick={() => onAnchorChange(new Date())}
            className="p-1 rounded-full active:opacity-60 -ml-1"
            aria-label="Перейти на сьогодні"
            title="Сьогодні"
          >
            <ChevronsRight size={18} color="rgba(255,255,255,0.6)" />
          </button>
        )}
      </div>
    </div>
  )
}
