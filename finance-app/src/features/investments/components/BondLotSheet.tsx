import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Money } from '@/lib/utils/money'
import type { LocalBondLot } from '@/lib/db/schema'

interface BondLotSheetProps {
  lot: LocalBondLot | null // null → додаємо нову партію, інакше редагуємо цю
  currency: string
  isSaving: boolean
  onSave: (input: { date: string; quantity: number; price: number }) => void
  onDelete?: () => void
  onClose: () => void
}

const CURRENCY_SYMBOLS: Record<string, string> = { UAH: '₴', USD: '$', EUR: '€' }

// Bottom-sheet для додавання/редагування однієї партії (лота) купівлі
// облігації — дата, кількість, ціна за штуку саме цієї покупки. За
// зразком DepositContributionSheet.tsx.
export function BondLotSheet({ lot, currency, isSaving, onSave, onDelete, onClose }: BondLotSheetProps) {
  const [date, setDate] = useState(lot?.purchase_date.slice(0, 10) ?? new Date().toISOString().slice(0, 10))
  const [quantity, setQuantity] = useState(lot ? String(lot.quantity) : '')
  const [price, setPrice] = useState(lot ? String(lot.purchase_price / 100) : '')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const symbol = CURRENCY_SYMBOLS[currency] ?? currency

  const handleSave = () => {
    const quantityNum = parseFloat(quantity.replace(',', '.'))
    const priceNum = parseFloat(price.replace(',', '.'))

    if (!quantity || isNaN(quantityNum) || quantityNum <= 0) {
      setError('Введіть кількість більше 0')
      return
    }
    if (!price || isNaN(priceNum) || priceNum < 0) {
      setError('Введіть ціну купівлі')
      return
    }

    onSave({ date, quantity: quantityNum, price: Math.round(priceNum * 100) })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-t-3xl p-6 pb-10 flex flex-col gap-4"
        style={{ backgroundColor: 'var(--color-bg-card)' }}
      >
        <p className="text-base font-semibold text-center" style={{ color: 'var(--color-text-primary)' }}>
          {lot ? 'Редагувати партію' : 'Докупити'}
        </p>

        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Дата купівлі
          </p>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full text-base bg-transparent border-none outline-none"
            style={{ color: 'var(--color-text-primary)', colorScheme: 'dark' }}
          />
          <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 8 }} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Кількість
            </p>
            <input
              autoFocus
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value.replace(/[^0-9.,]/g, ''))}
              className="w-full text-xl font-bold bg-transparent border-none outline-none"
              style={{ color: 'var(--color-text-primary)' }}
            />
            <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 8 }} />
          </div>

          <div>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Ціна за шт ({symbol})
            </p>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9.,]/g, ''))}
              className="w-full text-xl font-bold bg-transparent border-none outline-none"
              style={{ color: 'var(--color-text-primary)' }}
            />
            <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 8 }} />
          </div>
        </div>

        {lot && (
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Сума партії: {Money.fromKopiyky(lot.quantity * lot.purchase_price).formatCompact(symbol)}
          </p>
        )}

        {error && (
          <p className="text-sm" style={{ color: 'var(--color-expense)' }}>
            {error}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-3 rounded-2xl font-semibold text-sm disabled:opacity-60"
          style={{ backgroundColor: 'var(--color-accent)', color: '#1B2A2A' }}
        >
          {isSaving ? 'Зберігаємо...' : 'Зберегти'}
        </button>

        {lot && onDelete && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl font-semibold text-sm"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-expense)' }}
          >
            <Trash2 size={14} />
            Видалити партію
          </button>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl font-semibold text-sm"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-text-primary)' }}
        >
          Скасувати
        </button>
      </div>

      {/* ── Підтвердження видалення партії ─────────────────── */}
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
              Видалити цю партію?
            </p>
            <button
              onClick={onDelete}
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
