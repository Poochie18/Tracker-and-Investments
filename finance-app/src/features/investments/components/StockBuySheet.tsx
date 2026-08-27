import { useState } from 'react'
import { Money } from '@/lib/utils/money'

interface StockBuySheetProps {
  currency: string
  currentQuantity: number
  currentPurchasePrice: number  // копійки за 1 шт
  isSaving: boolean
  onSave: (input: { date: string; quantity: number; price: number }) => void
  onClose: () => void
}

const CURRENCY_SYMBOLS: Record<string, string> = { UAH: '₴', USD: '$', EUR: '€' }

// Bottom-sheet "Докупити" для акції — на відміну від облігацій (партії з
// власною датою кожної, bond-lots-repo.ts), тут простий "плаский" облік:
// кількість підсумовується, середня ціна купівлі — просте середнє старої
// і нової ціни (investmentsRepo.buyMoreStock). Показуємо прев'ю нової
// середньої ціни одразу під полем — щоб було видно ефект ДО збереження.
export function StockBuySheet({
  currency,
  currentQuantity,
  currentPurchasePrice,
  isSaving,
  onSave,
  onClose,
}: StockBuySheetProps) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState<string | null>(null)

  const symbol = CURRENCY_SYMBOLS[currency] ?? currency
  const priceNum = parseFloat(price.replace(',', '.'))
  const quantityNum = parseFloat(quantity.replace(',', '.'))
  const previewAvgPrice =
    !isNaN(priceNum) && priceNum >= 0
      ? Money.fromKopiyky(Math.round((currentPurchasePrice + Math.round(priceNum * 100)) / 2)).formatCompact(symbol)
      : null

  const handleSave = () => {
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
          Докупити
        </p>
        <p className="text-xs text-center" style={{ color: 'var(--color-text-secondary)' }}>
          Зараз: {currentQuantity} шт по {Money.fromKopiyky(currentPurchasePrice).formatCompact(symbol)} (середня)
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

        {previewAvgPrice && (
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Нова середня ціна купівлі: <span style={{ color: 'var(--color-accent)' }}>{previewAvgPrice}</span>
            {' '}(попередня + ця, навпіл)
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

        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl font-semibold text-sm"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-text-primary)' }}
        >
          Скасувати
        </button>
      </div>
    </div>
  )
}
