import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useTransactions } from '@/hooks/use-transactions'
import { useCategories } from '@/hooks/use-categories'
import { useUIStore, type PeriodType } from '@/stores/ui-store'
import { getPeriodRange, formatPeriodHeader } from '@/lib/utils/dates'
import { Money } from '@/lib/utils/money'
import { PeriodSelector } from './PeriodSelector'
import { PeriodNavigator } from './PeriodNavigator'
import { DonutChart } from './DonutChart'
import { CategoryListItem } from './CategoryListItem'
import type { LocalCategory, TransactionType } from '@/lib/db/schema'

interface CategoryBreakdownChartProps {
  type: TransactionType
}

// Розбивка витрат/доходів за категоріями з фільтром по періоду (рік/
// місяць/тиждень/день/довільний діапазон/весь час) — той самий набір
// фільтрів, що на "Огляді" (PeriodSelector/PeriodNavigator), але period/
// anchor тут ЛОКАЛЬНІ (не useUIStore.selectedPeriod/periodAnchor) — інакше
// перемикання періоду на цьому графіку зачіпало б і "Огляд"/"Список".
// Довільний діапазон дат (customFrom/customTo) — виняток: PeriodSelector
// сам читає/пише його через useUIStore, спільний з рештою застосунку
// (той самий "останній обраний діапазон", не проблема — просто UX-деталь).
export function CategoryBreakdownChart({ type }: CategoryBreakdownChartProps) {
  const { user } = useAuth()
  const [period, setPeriod] = useState<PeriodType>('month')
  const [anchor, setAnchor] = useState(() => new Date())
  const customFrom = useUIStore((s) => s.customFrom)
  const customTo = useUIStore((s) => s.customTo)

  const customRange = customFrom && customTo ? { from: customFrom, to: customTo } : null
  const { from, to } = getPeriodRange(period, anchor, customRange)
  const periodHeader = formatPeriodHeader(period, anchor, customRange)

  // Як і useUIStore.setSelectedPeriod — зміна типу періоду скидає якір на
  // сьогодні, інакше перемикання з "День" (у минулому) на "Місяць" показало
  // б чужий місяць.
  const handlePeriodChange = (p: PeriodType) => {
    setPeriod(p)
    setAnchor(new Date())
  }

  const { data: transactions = [] } = useTransactions({
    userId: user?.id ?? '',
    dateFrom: from,
    dateTo: to,
    type,
  })
  const { data: categories = [] } = useCategories(user?.id)

  const total = useMemo(() => transactions.reduce((sum, t) => sum + t.amount, 0), [transactions])

  const categoryTotals = useMemo(() => {
    const grouped = new Map<string, { amount: number; category: LocalCategory }>()
    for (const tx of transactions) {
      const cat = categories.find((c) => c.id === tx.category_id)
      if (!cat) continue
      const prev = grouped.get(tx.category_id)
      grouped.set(tx.category_id, { amount: (prev?.amount ?? 0) + tx.amount, category: cat })
    }

    return Array.from(grouped.values())
      .map((g) => ({
        category: g.category,
        amount: g.amount,
        percentage: total > 0 ? (g.amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [transactions, categories, total])

  const donutData = categoryTotals.map((g) => ({
    name: g.category.name,
    value: g.amount,
    color: g.category.color_hex,
  }))

  return (
    <div className="flex flex-col gap-2">
      <PeriodNavigator period={period} anchor={anchor} label={periodHeader} onAnchorChange={setAnchor} />
      <PeriodSelector active={period} onChange={handlePeriodChange} />

      <DonutChart
        data={donutData}
        centerLabel={Money.fromKopiyky(total).formatCompact()}
        centerSublabel={type === 'expense' ? 'витрати' : 'доходи'}
      />

      <div
        className="mx-4 rounded-2xl overflow-hidden mb-4"
        style={{ backgroundColor: 'var(--color-bg-card)' }}
      >
        {categoryTotals.length === 0 ? (
          <p className="text-center text-sm py-8" style={{ color: 'var(--color-text-secondary)' }}>
            Транзакцій за цей період немає.
          </p>
        ) : (
          categoryTotals.map((g, i) => (
            <div key={g.category.id}>
              <CategoryListItem category={g.category} amount={g.amount} percentage={g.percentage} />
              {i < categoryTotals.length - 1 && (
                <div className="mx-4" style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
