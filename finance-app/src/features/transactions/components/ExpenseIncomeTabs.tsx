interface ExpenseIncomeTabsProps {
  active: 'expense' | 'income'
  onChange: (tab: 'expense' | 'income') => void
  className?: string
}

export function ExpenseIncomeTabs({ active, onChange, className = '' }: ExpenseIncomeTabsProps) {
  return (
    <div
      className={`flex rounded-xl p-1 ${className}`}
      style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}
    >
      {(['expense', 'income'] as const).map((tab) => {
        const isActive = active === tab
        const label = tab === 'expense' ? 'Витрати' : 'Доходи'
        return (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            className="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
            style={{
              backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: isActive
                ? tab === 'expense'
                  ? 'var(--color-expense)'
                  : 'var(--color-income)'
                : 'var(--color-text-secondary)',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
