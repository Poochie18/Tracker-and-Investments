import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { ChevronDown, ChevronUp, Pencil, PlusCircle, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useBondCouponDates } from '@/hooks/use-bond-coupon-dates'
import { useDeleteInvestment } from '@/hooks/use-investments'
import { useExchangeRates } from '@/hooks/use-exchange-rates'
import { CategoryIconCircle } from '@/features/transactions/components/CategoryIconCircle'
import { Money } from '@/lib/utils/money'
import { formatPercent } from '@/lib/utils/format'
import { convertToUahMinorUnits } from '@/lib/investments/exchange-rate'
import { computeBondTotals, getBondCouponPaymentAmount } from '../bond-schedule'
import { BondPaymentSchedule } from './BondPaymentSchedule'
import { INVESTMENT_TYPE_META } from '../types'
import type { LocalInvestment } from '@/lib/db/schema'

interface BondListItemProps {
  investment: LocalInvestment
}

const CURRENCY_SYMBOLS: Record<string, string> = { UAH: '₴', USD: '$', EUR: '€' }

// Облігація у списку — так само, як депозит: клік розкриває зведення й
// графік виплат прямо на місці, без переходу на окрему сторінку деталей.
export function BondListItem({ investment }: BondListItemProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const meta = INVESTMENT_TYPE_META.bond
  const symbol = CURRENCY_SYMBOLS[investment.currency] ?? investment.currency
  const fmt = (kopiyky: number) => Money.fromKopiyky(kopiyky).formatCompact(symbol)

  const { data: dates = [] } = useBondCouponDates(investment.id)
  const { data: rates } = useExchangeRates()
  const deleteInvestment = useDeleteInvestment(user?.id ?? '')

  const maturityDate = investment.redemption_date
  // Прибуток облігації — сума всіх купонних виплат за весь строк (номінал
  // при погашенні — це повернення вкладеного, а не дохід).
  const totals = computeBondTotals(investment, dates)
  const totalSpent = totals.invested
  const isProfit = totals.profit >= 0
  const profitPercent = totals.invested === 0 ? 0 : (totals.profit / totals.invested) * 100
  // Сума прибутку завжди в гривнях (навіть якщо облігація в іншій валюті) —
  // щоб суми в списку були порівнювані між собою незалежно від валюти активу.
  const profitUah = rates ? convertToUahMinorUnits(totals.profit, investment.currency, rates) : null

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
            {investment.quantity} шт × {(investment.purchase_price / 100).toLocaleString('uk-UA')} {symbol}
          </p>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {fmt(totalSpent)}
          </p>
          <p className="text-xs mt-0.5" style={{ color: isProfit ? 'var(--color-income)' : 'var(--color-expense)' }}>
            {isProfit ? '+' : ''}{formatPercent(profitPercent, 1)}
            {profitUah != null && (
              <> ({isProfit ? '+' : ''}{Money.fromKopiyky(profitUah).formatWhole('₴')})</>
            )}
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
          {/* Дата купівлі / кількість / ціна за шт / сумарні витрати / погашення / прибуток */}
          <div className="grid grid-cols-2 gap-3 pt-3">
            <SummaryStat label="Дата купівлі" value={format(new Date(investment.purchase_date), 'd MMMM yyyy', { locale: uk })} />
            <SummaryStat label="Сумарні витрати" value={fmt(totalSpent)} />
            <SummaryStat label="Кількість" value={`${investment.quantity} шт`} />
            <SummaryStat label="Ціна за шт" value={`${(investment.purchase_price / 100).toLocaleString('uk-UA')} ${symbol}`} />
            <SummaryStat label="Дата погашення" value={maturityDate ? format(new Date(maturityDate), 'd MMMM yyyy', { locale: uk }) : '—'} />
            <SummaryStat label="Сума погашення" value={fmt(totals.redemptionAmount)} />
            <SummaryStat
              label="Прибуток (купони + різниця з номіналом)"
              value={`${isProfit ? '+' : ''}${fmt(totals.profit)}`}
              color={isProfit ? 'var(--color-income)' : 'var(--color-expense)'}
            />
          </div>

          {/* Графік виплат: купони + погашення */}
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Виплати
            </p>
            <BondPaymentSchedule
              dates={dates}
              redemptionDate={investment.redemption_date}
              couponAmount={getBondCouponPaymentAmount(investment)}
              redemptionAmount={totals.redemptionAmount}
              currency={investment.currency}
            />
          </div>

          {investment.notes && (
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {investment.notes}
            </p>
          )}

          {/* Дії */}
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => navigate(`/investments/${investment.id}/buy-more`)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--color-accent)' }}
            >
              <PlusCircle size={13} />
              Докупити
            </button>
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
              Видалити облігацію?
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

function SummaryStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>{label}</p>
      <p className="text-xs font-semibold" style={{ color: color ?? 'var(--color-text-primary)' }}>{value}</p>
    </div>
  )
}
