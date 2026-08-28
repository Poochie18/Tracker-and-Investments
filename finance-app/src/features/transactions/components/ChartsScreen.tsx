import { useState } from 'react'
import { AccountIconButton } from '@/components/AccountIconButton'
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator'
import { MonthlyIncomeExpenseChart } from './MonthlyIncomeExpenseChart'
import { CategoryBreakdownChart } from './CategoryBreakdownChart'

type ChartTab = 'monthly' | 'expense' | 'income'

const TABS: { key: ChartTab; label: string }[] = [
  { key: 'monthly', label: 'По місяцях' },
  { key: 'expense', label: 'Витрати' },
  { key: 'income', label: 'Доходи' },
]

// Розширені графіки: дохід/витрати/прибуток по місяцях за рік +
// розбивка витрат і доходів за категоріями з власним фільтром по періоду
// (рік/місяць/тиждень/день/довільний діапазон/весь час). Три графіки під
// локальними табами — той самий сегмент-контрол, що ExpenseIncomeTabs,
// але з трьома опціями замість двох.
export function ChartsScreen() {
  const [tab, setTab] = useState<ChartTab>('monthly')

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
        <AccountIconButton />
        <h1 className="text-xl font-semibold flex-1" style={{ color: 'var(--color-text-primary)' }}>
          Графіки
        </h1>
        <SyncStatusIndicator />
      </div>

      {/* ── Таби графіків ─────────────────────────────────── */}
      <div className="px-4 pt-3">
        <div className="flex rounded-xl p-1" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
          {TABS.map(({ key, label }) => {
            const isActive = tab === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
                style={{
                  backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-4 py-4 pb-24">
        {tab === 'monthly' && <MonthlyIncomeExpenseChart />}
        {tab === 'expense' && <CategoryBreakdownChart type="expense" />}
        {tab === 'income' && <CategoryBreakdownChart type="income" />}
      </div>
    </div>
  )
}
