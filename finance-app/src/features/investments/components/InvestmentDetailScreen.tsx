import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useInvestment, useDeleteInvestment } from '@/hooks/use-investments'
import { CategoryIconCircle } from '@/features/transactions/components/CategoryIconCircle'
import { Money } from '@/lib/utils/money'
import { formatPercent } from '@/lib/utils/format'
import { INVESTMENT_TYPE_META } from '../types'

const CURRENCY_SYMBOLS: Record<string, string> = {
  UAH: '₴',
  USD: '$',
  EUR: '€',
}

// Детальна картка активу — перегляд без редагування.
// Клік по активу в списку веде сюди; звідси — на редагування або видалення.
export function InvestmentDetailScreen() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { data: investment, isLoading } = useInvestment(id)
  const deleteInvestment = useDeleteInvestment(user?.id ?? '')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (isLoading) return null

  if (!investment) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-full gap-4 p-6"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <p className="text-sm">Актив не знайдено</p>
        <button onClick={() => navigate('/investments')} style={{ color: 'var(--color-accent)' }}>
          До списку інвестицій
        </button>
      </div>
    )
  }

  const meta = INVESTMENT_TYPE_META[investment.type]
  const symbol = CURRENCY_SYMBOLS[investment.currency] ?? investment.currency

  const invested = Money.fromKopiyky(Math.round(investment.purchase_price * investment.quantity))
  const currentValue = Money.fromKopiyky(Math.round(investment.current_price * investment.quantity))
  const pnl = currentValue.subtract(invested)
  const pnlPercent = invested.isZero() ? 0 : (pnl.toKopiyky() / invested.toKopiyky()) * 100
  const isProfit = pnl.isPositive() || pnl.isZero()

  const handleDelete = async () => {
    await deleteInvestment.mutateAsync(investment.id)
    navigate('/investments')
  }

  return (
    <div
      className="flex flex-col min-h-full"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
      {/* ── Шапка ─────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 pb-4"
        style={{
          backgroundColor: 'var(--color-bg-header)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        }}
      >
        <button onClick={() => navigate(-1)} className="p-1 -ml-1">
          <ArrowLeft size={22} color="var(--color-text-primary)" />
        </button>
        <h1 className="text-lg font-semibold flex-1 truncate" style={{ color: 'var(--color-text-primary)' }}>
          {investment.name}
        </h1>
        <button onClick={() => navigate(`/investments/${investment.id}/edit`)} className="p-1">
          <Pencil size={20} color="var(--color-text-primary)" />
        </button>
        <button onClick={() => setShowDeleteConfirm(true)} className="p-1">
          <Trash2 size={20} color="var(--color-expense)" />
        </button>
      </div>

      <div className="flex flex-col gap-4 py-5 px-4">
        {/* ── Заголовок картки: іконка типу + назва + тип ─────── */}
        <div className="flex items-center gap-3">
          <CategoryIconCircle iconName={meta.iconName} colorHex={meta.colorHex} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
              {investment.name}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              {meta.label} · {investment.currency}
            </p>
          </div>
        </div>

        {/* ── Поточна вартість + P&L ──────────────────────────── */}
        <div
          className="p-5 rounded-3xl flex flex-col gap-3"
          style={{ backgroundColor: 'var(--color-bg-card)' }}
        >
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Поточна вартість
            </p>
            <p className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {currentValue.formatCompact(symbol)}
            </p>
          </div>
          <p className="text-sm font-semibold" style={{ color: isProfit ? 'var(--color-income)' : 'var(--color-expense)' }}>
            {isProfit ? '+' : ''}{pnl.formatCompact(symbol)} ({isProfit ? '+' : ''}{formatPercent(pnlPercent, 1)})
          </p>
        </div>

        {/* ── Деталі ───────────────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: 'var(--color-bg-card)' }}
        >
          <DetailRow label="Кількість" value={String(investment.quantity)} />
          <DetailRow label="Ціна купівлі" value={`${(investment.purchase_price / 100).toLocaleString('uk-UA')} ${symbol}`} />
          <DetailRow label="Поточна ціна" value={`${(investment.current_price / 100).toLocaleString('uk-UA')} ${symbol}`} />
          <DetailRow label="Вкладено" value={invested.formatCompact(symbol)} />
          <DetailRow label="Дата купівлі" value={format(new Date(investment.purchase_date), 'd MMMM yyyy', { locale: uk })} last={!investment.notes} />
          {investment.notes && <DetailRow label="Нотатки" value={investment.notes} last />}
        </div>
      </div>

      {/* ── Діалог підтвердження видалення ───────────────────── */}
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
              Видалити актив?
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

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{label}</p>
        <p className="text-sm font-medium text-right max-w-[60%]" style={{ color: 'var(--color-text-primary)' }}>
          {value}
        </p>
      </div>
      {!last && <div className="mx-4" style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />}
    </div>
  )
}
