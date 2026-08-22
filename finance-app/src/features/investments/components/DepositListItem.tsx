import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useDepositContributions, useSetDepositContribution } from '@/hooks/use-deposit-contributions'
import { useDeleteInvestment } from '@/hooks/use-investments'
import { CategoryIconCircle } from '@/features/transactions/components/CategoryIconCircle'
import { Money } from '@/lib/utils/money'
import { formatPercent } from '@/lib/utils/format'
import { computeDepositSchedule } from '../deposit-schedule'
import { DepositScheduleTable } from './DepositScheduleTable'
import { DepositContributionSheet } from './DepositContributionSheet'
import { INVESTMENT_TYPE_META } from '../types'
import type { LocalInvestment } from '@/lib/db/schema'

interface DepositListItemProps {
  investment: LocalInvestment
}

const CURRENCY_SYMBOLS: Record<string, string> = { UAH: '₴', USD: '$', EUR: '€' }

// Депозит у списку — клік розкриває зведення й помісячний графік прямо
// на місці (не переходить на окрему сторінку деталей, на відміну від
// решти типів активів).
export function DepositListItem({ investment }: DepositListItemProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingMonth, setEditingMonth] = useState<{ index: number; label: string } | null>(null)

  const meta = INVESTMENT_TYPE_META.deposit
  const symbol = CURRENCY_SYMBOLS[investment.currency] ?? investment.currency

  const initialAmount = Math.round(investment.purchase_price * investment.quantity)
  const currentValue = Math.round(investment.current_price * investment.quantity)
  const pnl = currentValue - initialAmount
  const pnlPercent = initialAmount === 0 ? 0 : (pnl / initialAmount) * 100
  const isProfit = pnl >= 0

  const { data: contributions = [] } = useDepositContributions(expanded ? investment.id : undefined)
  const setContribution = useSetDepositContribution(user?.id ?? '', investment.id)
  const deleteInvestment = useDeleteInvestment(user?.id ?? '')

  const schedule = computeDepositSchedule(investment, contributions)

  const handleSaveContribution = async (amountUnits: number) => {
    if (!editingMonth) return
    await setContribution.mutateAsync({ monthIndex: editingMonth.index, amount: amountUnits })
    setEditingMonth(null)
  }

  const handleDelete = async () => {
    await deleteInvestment.mutateAsync(investment.id)
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
      {/* ── Заголовок (клік — розгорнути/згорнути) ─────────── */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-3 px-4 py-3 w-full text-left transition-opacity active:opacity-70"
      >
        <CategoryIconCircle iconName={meta.iconName} colorHex={meta.colorHex} size="md" />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
            {investment.name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {investment.interest_rate_percent != null ? `${investment.interest_rate_percent}% річних` : 'Ставка не вказана'}
          </p>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {Money.fromKopiyky(currentValue).formatCompact(symbol)}
          </p>
          <p className="text-xs mt-0.5" style={{ color: isProfit ? 'var(--color-income)' : 'var(--color-expense)' }}>
            {isProfit ? '+' : ''}{formatPercent(pnlPercent, 1)}
          </p>
        </div>

        {expanded ? (
          <ChevronUp size={18} style={{ color: 'var(--color-text-secondary)' }} />
        ) : (
          <ChevronDown size={18} style={{ color: 'var(--color-text-secondary)' }} />
        )}
      </button>

      {/* ── Розкрита сводка ─────────────────────────────────── */}
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Початкова сума / ставка / строк */}
          <div className="grid grid-cols-3 gap-2 pt-3">
            <SummaryStat label="Початкова сума" value={Money.fromKopiyky(initialAmount).formatCompact(symbol)} />
            <SummaryStat
              label="Ставка"
              value={investment.interest_rate_percent != null ? `${investment.interest_rate_percent}%` : '—'}
            />
            <SummaryStat label="Строк" value={investment.term_months != null ? `${investment.term_months} міс.` : '—'} />
          </div>

          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Відкрито {format(new Date(investment.purchase_date), 'd MMMM yyyy', { locale: uk })}
          </p>

          {/* Помісячний графік */}
          {investment.term_months ? (
            <DepositScheduleTable
              rows={schedule}
              purchaseDate={investment.purchase_date}
              currency={investment.currency}
              onEditMonth={(index, label) => setEditingMonth({ index, label })}
            />
          ) : (
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Вкажи ставку і строк вкладу в редагуванні, щоб побачити графік нарахувань.
            </p>
          )}

          {/* Дії */}
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => navigate(`/investments/${investment.id}/edit`)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--color-text-primary)' }}
            >
              <Pencil size={13} />
              Редагувати
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--color-expense)' }}
            >
              <Trash2 size={13} />
              Видалити
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom sheet: поповнення за місяць ─────────────── */}
      {editingMonth && (
        <DepositContributionSheet
          monthIndex={editingMonth.index}
          monthLabel={editingMonth.label}
          currentAmount={contributions.find((c) => c.month_index === editingMonth.index)?.amount ?? 0}
          currency={investment.currency}
          isSaving={setContribution.isPending}
          onSave={handleSaveContribution}
          onClose={() => setEditingMonth(null)}
        />
      )}

      {/* ── Підтвердження видалення ─────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div
            className="relative w-full max-w-lg rounded-t-3xl p-6 pb-10 flex flex-col gap-4"
            style={{ backgroundColor: 'var(--color-bg-card)' }}
          >
            <p className="text-base font-semibold text-center" style={{ color: 'var(--color-text-primary)' }}>
              Видалити депозит?
            </p>
            <button
              onClick={handleDelete}
              className="w-full py-3 rounded-2xl font-semibold text-sm"
              style={{ backgroundColor: 'var(--color-expense)', color: '#fff' }}
            >
              Видалити
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
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

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>{label}</p>
      <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{value}</p>
    </div>
  )
}
