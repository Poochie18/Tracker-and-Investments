import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, X, Pencil } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useTransactions, useDeleteTransaction } from '@/hooks/use-transactions'
import { useCategories } from '@/hooks/use-categories'
import { useUIStore } from '@/stores/ui-store'
import { useFilterStore } from '@/stores/filter-store'
import { getPeriodRange, formatGroupDate, formatPeriodHeader } from '@/lib/utils/dates'
import { Money } from '@/lib/utils/money'
import { CategoryIconCircle } from './CategoryIconCircle'
import { PeriodSelector } from './PeriodSelector'
import { PeriodNavigator } from './PeriodNavigator'
import { SwipeToReveal } from '@/components/SwipeToReveal'
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator'
import { AccountIconButton } from '@/components/AccountIconButton'
import type { LocalTransaction } from '@/lib/db/schema'

export function TransactionsListScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const selectedPeriod = useUIStore((s) => s.selectedPeriod)
  const setSelectedPeriod = useUIStore((s) => s.setSelectedPeriod)
  const periodAnchor = useUIStore((s) => s.periodAnchor)
  const setPeriodAnchor = useUIStore((s) => s.setPeriodAnchor)
  const customFrom = useUIStore((s) => s.customFrom)
  const customTo = useUIStore((s) => s.customTo)
  const customRange = customFrom && customTo ? { from: customFrom, to: customTo } : null
  const categoryFilter = useFilterStore((s) => s.categoryFilter)
  const setCategoryFilter = useFilterStore((s) => s.setCategoryFilter)

  const { from, to } = getPeriodRange(selectedPeriod, periodAnchor, customRange)
  const periodHeader = formatPeriodHeader(selectedPeriod, periodAnchor, customRange)

  const { data: categories = [] } = useCategories(user?.id)
  const activeFilterCategory = categoryFilter ? categories.find((c) => c.id === categoryFilter) : null

  const { data: transactions = [], isLoading } = useTransactions({
    userId: user?.id ?? '',
    dateFrom: from,
    dateTo: to,
    categoryId: categoryFilter ?? undefined,
  })

  const deleteTransaction = useDeleteTransaction(user?.id ?? '')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const map = new Map<string, LocalTransaction[]>()
    for (const tx of transactions) {
      const key = formatGroupDate(tx.date)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(tx)
    }
    return map
  }, [transactions])

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteId) return
    await deleteTransaction.mutateAsync(confirmDeleteId)
    setConfirmDeleteId(null)
  }

  return (
    <div className="flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      {/* ── Шапка ─────────────────────────────────────────── */}
      <div
        className="px-4 pb-2"
        style={{
          backgroundColor: 'var(--color-bg-header)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <AccountIconButton />
            <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Транзакції
            </h1>
          </div>
          <SyncStatusIndicator />
        </div>

        <PeriodNavigator
          period={selectedPeriod}
          anchor={periodAnchor}
          label={periodHeader}
          onAnchorChange={setPeriodAnchor}
        />
      </div>

      <PeriodSelector active={selectedPeriod} onChange={setSelectedPeriod} />

      {/* ── Активний фільтр по категорії ─────────────────── */}
      {activeFilterCategory && (
        <div className="px-4 pb-2">
          <button
            onClick={() => setCategoryFilter(null)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ backgroundColor: 'var(--color-bg-card)' }}
          >
            <CategoryIconCircle
              iconName={activeFilterCategory.icon_name}
              colorHex={activeFilterCategory.color_hex}
              size="sm"
            />
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {activeFilterCategory.name}
            </span>
            <X size={14} style={{ color: 'var(--color-text-secondary)' }} />
          </button>
        </div>
      )}

      {/* ── Список ────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 px-4 pb-4">
        {isLoading && (
          <p className="text-center py-8 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Завантаження...
          </p>
        )}

        {!isLoading && grouped.size === 0 && (
          <p className="text-center py-12 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Транзакцій за цей період немає
          </p>
        )}

        {Array.from(grouped.entries()).map(([dateLabel, txs]) => (
          <div key={dateLabel}>
            <p
              className="text-xs font-semibold py-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {dateLabel}
            </p>

            <div
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: 'var(--color-bg-card)' }}
            >
              {txs.map((tx, i) => {
                const cat = categories.find((c) => c.id === tx.category_id)
                const amount = Money.fromKopiyky(tx.amount)
                const isExpense = tx.type === 'expense'

                return (
                  <div key={tx.id}>
                    <SwipeToReveal
                      actionWidth={72}
                      action={(close) => (
                        <button
                          onClick={() => {
                            close()
                            setConfirmDeleteId(tx.id)
                          }}
                          className="flex-1 flex flex-col items-center justify-center gap-1"
                          style={{ backgroundColor: 'var(--color-expense)', color: '#fff' }}
                        >
                          <Trash2 size={18} />
                          <span className="text-xs font-medium">Видалити</span>
                        </button>
                      )}
                      leftActionWidth={72}
                      leftAction={(close) => (
                        <button
                          onClick={() => {
                            close()
                            navigate(`/transactions/${tx.id}/edit`)
                          }}
                          className="flex-1 flex flex-col items-center justify-center gap-1"
                          style={{ backgroundColor: 'var(--color-accent)', color: '#1B2A2A' }}
                        >
                          <Pencil size={18} />
                          <span className="text-xs font-medium">Редагувати</span>
                        </button>
                      )}
                    >
                      <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                        {cat && (
                          <CategoryIconCircle
                            iconName={cat.icon_name}
                            colorHex={cat.color_hex}
                            size="sm"
                          />
                        )}

                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {cat?.name ?? 'Категорія'}
                          </p>
                          {tx.comment && (
                            <p
                              className="text-xs truncate"
                              style={{ color: 'var(--color-text-secondary)' }}
                            >
                              {tx.comment}
                            </p>
                          )}
                        </div>

                        <p
                          className="text-sm font-semibold flex-shrink-0"
                          style={{
                            color: isExpense ? 'var(--color-expense)' : 'var(--color-income)',
                          }}
                        >
                          {isExpense ? '−' : '+'}
                          {amount.formatCompact()}
                        </p>
                      </div>
                    </SwipeToReveal>

                    {i < txs.length - 1 && (
                      <div
                        className="ml-16"
                        style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Поп-ап підтвердження видалення ───────────────── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={() => setConfirmDeleteId(null)}
          />
          <div
            className="relative w-full max-w-lg rounded-t-3xl p-6 pb-10 flex flex-col gap-4"
            style={{ backgroundColor: 'var(--color-bg-card)' }}
          >
            <p className="text-base font-semibold text-center" style={{ color: 'var(--color-text-primary)' }}>
              Видалити транзакцію?
            </p>
            <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
              Цю дію неможливо скасувати
            </p>
            <button
              onClick={handleDeleteConfirm}
              disabled={deleteTransaction.isPending}
              className="w-full py-3 rounded-2xl font-semibold text-sm transition-opacity disabled:opacity-60"
              style={{ backgroundColor: 'var(--color-expense)', color: '#fff' }}
            >
              {deleteTransaction.isPending ? 'Видаляємо...' : 'Видалити'}
            </button>
            <button
              onClick={() => setConfirmDeleteId(null)}
              className="w-full py-3 rounded-2xl font-semibold text-sm"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-text-primary)' }}
            >
              Скасувати
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
