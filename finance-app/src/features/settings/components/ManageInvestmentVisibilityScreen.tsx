import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import {
  TOGGLEABLE_INVESTMENT_TYPES, TOGGLEABLE_TYPE_LABELS, useVisibleInvestmentTypes, setInvestmentTypeVisible,
} from '@/lib/settings/investment-visibility'

// Окремий екран (за зразком "Рахунки"/"Категорії") — які вкладки типів
// інвестицій показувати в другому ряду навігації (SecondaryNav в
// AppLayout.tsx). "Огляд" ховати не можна — стосується лише вкладок
// конкретного типу.
export function ManageInvestmentVisibilityScreen() {
  const navigate = useNavigate()
  const visibleTypes = useVisibleInvestmentTypes()

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      {/* ── Шапка ─────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 pb-4"
        style={{
          backgroundColor: 'var(--color-bg-header)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        }}
      >
        <button onClick={() => navigate(-1)} className="p-1 -ml-1">
          <ArrowLeft size={22} style={{ color: 'var(--color-text-primary)' }} />
        </button>
        <h1 className="text-lg font-semibold flex-1" style={{ color: 'var(--color-text-primary)' }}>
          Вкладки інвестицій
        </h1>
      </div>

      <p className="px-4 pt-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        Які вкладки показувати в меню розділу "Інвестиції". "Огляд" лишається завжди.
      </p>

      {/* ── Список ────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 p-4">
        {TOGGLEABLE_INVESTMENT_TYPES.map((type) => {
          const checked = visibleTypes.has(type)
          return (
            <button
              key={type}
              type="button"
              onClick={() => setInvestmentTypeVisible(type, !checked)}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl w-full text-left"
              style={{ backgroundColor: 'var(--color-bg-card)' }}
            >
              <span
                className="flex items-center justify-center rounded-md shrink-0 transition-colors"
                style={{
                  width: 22,
                  height: 22,
                  backgroundColor: checked ? 'var(--color-accent)' : 'transparent',
                  border: checked ? 'none' : '1.5px solid var(--color-text-secondary)',
                }}
              >
                {checked && <Check size={15} color="#1B2A2A" strokeWidth={3} />}
              </span>
              <span className="text-sm font-medium flex-1" style={{ color: 'var(--color-text-primary)' }}>
                {TOGGLEABLE_TYPE_LABELS[type]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
