import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { ChevronDown, ChevronUp, Pencil, PlusCircle, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useDeleteInvestment, useBuyMoreStock } from '@/hooks/use-investments'
import { CategoryIconCircle } from '@/features/transactions/components/CategoryIconCircle'
import { Money } from '@/lib/utils/money'
import { formatPercent } from '@/lib/utils/format'
import { StockBuySheet } from './StockBuySheet'
import { INVESTMENT_TYPE_META } from '../types'
import type { LocalInvestment } from '@/lib/db/schema'

interface StockListItemProps {
  investment: LocalInvestment
}

const CURRENCY_SYMBOLS: Record<string, string> = { UAH: '₴', USD: '$', EUR: '€' }

// Акція у списку — за зразком BondListItem/DepositListItem: клік розгортає
// зведення прямо на місці (а не окрема сторінка деталей). "Докупити" —
// простий облік (кількість підсумовується, ціна усереднюється навпіл), на
// відміну від облігацій тут немає окремих партій з датами кожної покупки.
export function StockListItem({ investment }: StockListItemProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showBuySheet, setShowBuySheet] = useState(false)

  const meta = INVESTMENT_TYPE_META.stock
  const symbol = CURRENCY_SYMBOLS[investment.currency] ?? investment.currency
  const fmt = (kopiyky: number) => Money.fromKopiyky(kopiyky).formatCompact(symbol)

  const deleteInvestment = useDeleteInvestment(user?.id ?? '')
  const buyMore = useBuyMoreStock(user?.id ?? '')

  const invested = Math.round(investment.purchase_price * investment.quantity)
  const currentValue = Math.round(investment.current_price * investment.quantity)
  const pnl = currentValue - invested
  const isProfit = pnl >= 0
  const pnlPercent = invested === 0 ? 0 : (pnl / invested) * 100

  const handleDelete = async () => {
    await deleteInvestment.mutateAsync(investment.id)
  }

  const handleBuyMore = async (input: { date: string; quantity: number; price: number }) => {
    await buyMore.mutateAsync({ id: investment.id, input })
    setShowBuySheet(false)
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
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
              {investment.name}
            </p>
            {investment.ticker_symbol && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-md flex-shrink-0 font-mono"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-text-secondary)' }}
              >
                {investment.ticker_symbol}
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {investment.quantity} шт
          </p>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {fmt(currentValue)}
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
          <div className="grid grid-cols-2 gap-3 pt-3">
            <SummaryStat label="Дата купівлі" value={format(new Date(investment.purchase_date), 'd MMMM yyyy', { locale: uk })} />
            <SummaryStat label="Кількість" value={`${investment.quantity} шт`} />
            <SummaryStat label="Середня ціна купівлі" value={`${(investment.purchase_price / 100).toLocaleString('uk-UA')} ${symbol}`} />
            <SummaryStat label="Поточна ціна" value={`${(investment.current_price / 100).toLocaleString('uk-UA')} ${symbol}`} />
            <SummaryStat label="Вкладено" value={fmt(invested)} />
            <SummaryStat label="Поточна вартість" value={fmt(currentValue)} />
            <SummaryStat
              label="Прибуток / збиток"
              value={`${isProfit ? '+' : ''}${fmt(pnl)} (${isProfit ? '+' : ''}${formatPercent(pnlPercent, 1)})`}
              color={isProfit ? 'var(--color-income)' : 'var(--color-expense)'}
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
              onClick={() => setShowBuySheet(true)}
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

      {/* ── Bottom-sheet "Докупити" ──────────────────────────── */}
      {showBuySheet && (
        <StockBuySheet
          currency={investment.currency}
          currentQuantity={investment.quantity}
          currentPurchasePrice={investment.purchase_price}
          isSaving={buyMore.isPending}
          onSave={handleBuyMore}
          onClose={() => setShowBuySheet(false)}
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
              Видалити акцію?
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
