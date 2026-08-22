import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useAccount } from '@/hooks/use-account'
import { useTransactions } from '@/hooks/use-transactions'
import { useCategories } from '@/hooks/use-categories'
import { useUIStore } from '@/stores/ui-store'
import { useFilterStore } from '@/stores/filter-store'
import { getPeriodRange, formatPeriodHeader } from '@/lib/utils/dates'
import { Money } from '@/lib/utils/money'
import { ExpenseIncomeTabs } from './ExpenseIncomeTabs'
import { PeriodSelector } from './PeriodSelector'
import { PeriodNavigator } from './PeriodNavigator'
import { DonutChart } from './DonutChart'
import { CategoryListItem } from './CategoryListItem'
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator'
import type { LocalCategory } from '@/lib/db/schema'

export function OverviewScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  void useAccount(user?.id)
  const activeTab = useUIStore((s) => s.activeTab)
  const setActiveTab = useUIStore((s) => s.setActiveTab)
  const selectedPeriod = useUIStore((s) => s.selectedPeriod)
  const setSelectedPeriod = useUIStore((s) => s.setSelectedPeriod)
  const periodAnchor = useUIStore((s) => s.periodAnchor)
  const setPeriodAnchor = useUIStore((s) => s.setPeriodAnchor)
  const customFrom = useUIStore((s) => s.customFrom)
  const customTo = useUIStore((s) => s.customTo)
  const setCategoryFilter = useFilterStore((s) => s.setCategoryFilter)

  const customRange = customFrom && customTo ? { from: customFrom, to: customTo } : null
  const { from, to } = getPeriodRange(selectedPeriod, periodAnchor, customRange)
  const periodHeader = formatPeriodHeader(selectedPeriod, periodAnchor, customRange)

  const handleCategoryPress = (categoryId: string) => {
    setCategoryFilter(categoryId)
    navigate('/list')
  }

  const { data: transactions = [] } = useTransactions({
    userId: user?.id ?? '',
    dateFrom: from,
    dateTo: to,
  })

  const { data: categories = [] } = useCategories(user?.id)

  // Net balance = income - expenses (для всіх транзакцій за період)
  const { expenseTotal, incomeTotal, netAmount } = useMemo(() => {
    const expenseTotal = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
    const incomeTotal = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
    return { expenseTotal, incomeTotal, netAmount: incomeTotal - expenseTotal }
  }, [transactions])

  // Групуємо транзакції по категоріям для активної вкладки
  const categoryTotals = useMemo(() => {
    const tabTotal = activeTab === 'expense' ? expenseTotal : incomeTotal
    const filtered = transactions.filter((t) => t.type === activeTab)

    const grouped = new Map<string, { amount: number; category: LocalCategory }>()
    for (const tx of filtered) {
      const cat = categories.find((c) => c.id === tx.category_id)
      if (!cat) continue
      const prev = grouped.get(tx.category_id)
      grouped.set(tx.category_id, {
        amount: (prev?.amount ?? 0) + tx.amount,
        category: cat,
      })
    }

    return Array.from(grouped.values())
      .map((g) => ({
        category: g.category,
        amount: g.amount,
        percentage: tabTotal > 0 ? (g.amount / tabTotal) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [transactions, categories, activeTab, expenseTotal, incomeTotal])

  const tabTotal = activeTab === 'expense' ? expenseTotal : incomeTotal
  const netMoney = Money.fromKopiyky(Math.abs(netAmount))
  const tabMoney = Money.fromKopiyky(tabTotal)

  const donutData = categoryTotals.map((g) => ({
    name: g.category.name,
    value: g.amount,
    color: g.category.color_hex,
  }))

  const netColor = netAmount >= 0 ? 'var(--color-income)' : 'var(--color-expense)'
  const netPrefix = netAmount >= 0 ? '+' : '−'

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      {/* ── Шапка ─────────────────────────────────────────── */}
      <div
        className="px-4 pb-4"
        style={{
          backgroundColor: 'var(--color-bg-header)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        }}
      >
        {/* Дата по центру (зі стрілками навігації) + sync справа */}
        <div className="relative flex items-center justify-center mb-2">
          <PeriodNavigator
            period={selectedPeriod}
            anchor={periodAnchor}
            label={periodHeader}
            onAnchorChange={setPeriodAnchor}
          />
          <div className="absolute right-0">
            <SyncStatusIndicator />
          </div>
        </div>

        {/* Різниця доходів і витрат по центру */}
        <div className="flex flex-col items-center mb-4">
          <p className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Баланс за період
          </p>
          <p className="text-4xl font-bold" style={{ color: netColor }}>
            {netPrefix}{netMoney.format('UAH')}
          </p>
          <div className="flex gap-4 mt-2">
            <span className="text-xs" style={{ color: 'var(--color-income)' }}>
              +{Money.fromKopiyky(incomeTotal).formatCompact()}
            </span>
            <span className="text-xs" style={{ color: 'var(--color-expense)' }}>
              −{Money.fromKopiyky(expenseTotal).formatCompact()}
            </span>
          </div>
        </div>

        <ExpenseIncomeTabs active={activeTab} onChange={setActiveTab} />
      </div>

      {/* ── Селектор періоду ──────────────────────────────── */}
      <PeriodSelector active={selectedPeriod} onChange={setSelectedPeriod} />

      {/* ── Пончик ────────────────────────────────────────── */}
      <DonutChart
        data={donutData}
        centerLabel={tabMoney.formatCompact()}
        centerSublabel={activeTab === 'expense' ? 'витрати' : 'доходи'}
      />

      {/* ── Список категорій ──────────────────────────────── */}
      <div
        className="mx-4 rounded-2xl overflow-hidden mb-4"
        style={{ backgroundColor: 'var(--color-bg-card)' }}
      >
        {categoryTotals.length === 0 ? (
          <p
            className="text-center text-sm py-8"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Транзакцій за цей період немає.{'\n'}
            Натисни «+» щоб додати першу.
          </p>
        ) : (
          categoryTotals.map((g, i) => (
            <div key={g.category.id}>
              <CategoryListItem
                category={g.category}
                amount={g.amount}
                percentage={g.percentage}
                onPress={() => handleCategoryPress(g.category.id)}
              />
              {i < categoryTotals.length - 1 && (
                <div
                  className="mx-4"
                  style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }}
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
