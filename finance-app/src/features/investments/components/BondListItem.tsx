import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { ChevronDown, ChevronUp, Pencil, PlusCircle, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useBondCouponDates } from '@/hooks/use-bond-coupon-dates'
import { useBondLots, useAddBondLot, useUpdateBondLot, useDeleteBondLot } from '@/hooks/use-bond-lots'
import { useDeleteInvestment } from '@/hooks/use-investments'
import { useExchangeRates } from '@/hooks/use-exchange-rates'
import { CategoryIconCircle } from '@/features/transactions/components/CategoryIconCircle'
import { Money } from '@/lib/utils/money'
import { convertToUahMinorUnits } from '@/lib/investments/exchange-rate'
import { computeBondTotals } from '../bond-schedule'
import { BondPaymentSchedule } from './BondPaymentSchedule'
import { BondLotSheet } from './BondLotSheet'
import { INVESTMENT_TYPE_META } from '../types'
import type { LocalBondLot, LocalInvestment } from '@/lib/db/schema'

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
  // null = закрито, 'new' = додати партію, LocalBondLot = редагувати цю
  const [lotSheet, setLotSheet] = useState<'new' | LocalBondLot | null>(null)

  const meta = INVESTMENT_TYPE_META.bond
  const symbol = CURRENCY_SYMBOLS[investment.currency] ?? investment.currency
  const fmt = (kopiyky: number) => Money.fromKopiyky(kopiyky).formatCompact(symbol)

  const { data: dates = [] } = useBondCouponDates(investment.id)
  const { data: lots = [] } = useBondLots(investment.id)
  const { data: rates } = useExchangeRates()
  const deleteInvestment = useDeleteInvestment(user?.id ?? '')
  const addLot = useAddBondLot(user?.id ?? '', investment.id)
  const updateLot = useUpdateBondLot(user?.id ?? '', investment.id)
  const deleteLot = useDeleteBondLot(user?.id ?? '', investment.id)

  const maturityDate = investment.redemption_date
  // Прибуток облігації — сума всіх купонних виплат за весь строк (номінал
  // при погашенні — це повернення вкладеного, а не дохід).
  const totals = computeBondTotals(investment, dates, lots)
  const totalSpent = totals.invested
  // Середня ціна за шт — окремі партії можуть мати різну ціну купівлі,
  // тому єдиної "ціни за шт" більше нема (див. список партій нижче).
  const avgPricePerUnit = investment.quantity > 0 ? totalSpent / investment.quantity : 0
  const isProfit = totals.profit >= 0
  // Сума прибутку завжди в гривнях (навіть якщо облігація в іншій валюті) —
  // щоб суми в списку були порівнювані між собою незалежно від валюти активу.
  const profitUah = rates ? convertToUahMinorUnits(totals.profit, investment.currency, rates) : null

  const handleDelete = async () => {
    await deleteInvestment.mutateAsync(investment.id)
  }

  const isSavingLot = addLot.isPending || updateLot.isPending

  const handleSaveLot = async (input: { date: string; quantity: number; price: number }) => {
    if (lotSheet === 'new') {
      await addLot.mutateAsync(input)
    } else if (lotSheet) {
      await updateLot.mutateAsync({ lotId: lotSheet.id, input })
    }
    setLotSheet(null)
  }

  const handleDeleteLot = async () => {
    if (lotSheet && lotSheet !== 'new') {
      await deleteLot.mutateAsync(lotSheet.id)
    }
    setLotSheet(null)
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
            {investment.quantity} шт
          </p>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {fmt(totalSpent)}
          </p>
          {profitUah != null && (
            <p className="text-xs mt-0.5" style={{ color: isProfit ? 'var(--color-income)' : 'var(--color-expense)' }}>
              {isProfit ? '+' : ''}{Money.fromKopiyky(profitUah).formatWhole('₴')}
            </p>
          )}
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
          {/* Дата купівлі / кількість / середня ціна за шт / сумарні витрати / погашення / прибуток */}
          <div className="grid grid-cols-2 gap-3 pt-3">
            <SummaryStat label="Дата купівлі" value={format(new Date(investment.purchase_date), 'd MMMM yyyy', { locale: uk })} />
            <SummaryStat label="Сумарні витрати" value={fmt(totalSpent)} />
            <SummaryStat label="Кількість" value={`${investment.quantity} шт`} />
            <SummaryStat label="Середня ціна за шт" value={`${(avgPricePerUnit / 100).toLocaleString('uk-UA')} ${symbol}`} />
            <SummaryStat label="Дата погашення" value={maturityDate ? format(new Date(maturityDate), 'd MMMM yyyy', { locale: uk }) : '—'} />
            <SummaryStat label="Сума погашення" value={fmt(totals.redemptionAmount)} />
            <SummaryStat
              label="Прибуток (купони + різниця з номіналом)"
              value={`${isProfit ? '+' : ''}${fmt(totals.profit)}`}
              color={isProfit ? 'var(--color-income)' : 'var(--color-expense)'}
            />
          </div>

          {/* Партії купівлі: кожна покупка (первинна чи докупівля) окремим
              рядком — тап відкриває редагування, "Докупити" додає нову. */}
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Партії купівлі
            </p>
            <div className="flex flex-col gap-1">
              {lots.map((lot) => (
                <button
                  key={lot.id}
                  type="button"
                  onClick={() => setLotSheet(lot)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left"
                  style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {format(new Date(lot.purchase_date), 'd MMMM yyyy', { locale: uk })}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                      {lot.quantity} шт × {(lot.purchase_price / 100).toLocaleString('uk-UA')} {symbol}
                    </p>
                  </div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {fmt(lot.quantity * lot.purchase_price)}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Графік виплат: купони + погашення */}
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Виплати
            </p>
            <BondPaymentSchedule
              dates={dates}
              redemptionDate={investment.redemption_date}
              lots={lots}
              couponAmountPerUnit={investment.coupon_amount}
              redemptionAmountPerUnit={investment.redemption_amount ?? investment.purchase_price}
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
              onClick={() => setLotSheet('new')}
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

      {/* ── Bottom-sheet додавання/редагування партії ───────── */}
      {lotSheet && (
        <BondLotSheet
          lot={lotSheet === 'new' ? null : lotSheet}
          currency={investment.currency}
          isSaving={isSavingLot}
          onSave={handleSaveLot}
          onDelete={lotSheet !== 'new' ? handleDeleteLot : undefined}
          onClose={() => setLotSheet(null)}
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
