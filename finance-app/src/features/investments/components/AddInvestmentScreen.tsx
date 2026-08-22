import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import {
  useInvestment,
  useCreateInvestment,
  useUpdateInvestment,
  useDeleteInvestment,
} from '@/hooks/use-investments'
import { CategoryIconCircle } from '@/features/transactions/components/CategoryIconCircle'
import { INVESTMENT_TYPES, INVESTMENT_TYPE_META } from '../types'
import type { InvestmentType, LocalInvestment } from '@/lib/db/schema'

const CURRENCIES = ['UAH', 'USD', 'EUR']

// Обгортка-роутер: чекає завантаження активу при редагуванні (Dexie — асинхронний),
// а саму форму монтує з key={id ?? 'new'} — тому InvestmentForm ініціалізує
// свій стан напряму з даних, без setState всередині ефекту.
export function AddInvestmentScreen() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const { data: existing, isLoading } = useInvestment(id)

  // При редагуванні чекаємо поки Dexie віддасть запис — інакше форма
  // на мить змонтується порожньою і одразу перемонтується.
  if (isEdit && isLoading) return null

  return <InvestmentForm key={id ?? 'new'} id={id} existing={existing} />
}

interface InvestmentFormProps {
  id: string | undefined
  existing: LocalInvestment | undefined
}

function InvestmentForm({ id, existing }: InvestmentFormProps) {
  const navigate = useNavigate()
  const isEdit = !!id

  const { user } = useAuth()
  const createInvestment = useCreateInvestment(user?.id ?? '')
  const updateInvestment = useUpdateInvestment(user?.id ?? '')
  const deleteInvestment = useDeleteInvestment(user?.id ?? '')

  const [name, setName] = useState(existing?.name ?? '')
  const [type, setType] = useState<InvestmentType>(existing?.type ?? 'stock')
  const [quantity, setQuantity] = useState(existing ? String(existing.quantity) : '')
  const [purchasePrice, setPurchasePrice] = useState(
    existing ? String(existing.purchase_price / 100) : ''
  )
  const [currentPrice, setCurrentPrice] = useState(
    existing ? String(existing.current_price / 100) : ''
  )
  const [currency, setCurrency] = useState(existing?.currency ?? 'UAH')
  const [purchaseDate, setPurchaseDate] = useState(
    existing?.purchase_date.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
  )
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const isSaving = createInvestment.isPending || updateInvestment.isPending

  const handleSave = async () => {
    setError(null)

    const quantityNum = parseFloat(quantity.replace(',', '.'))
    const purchasePriceNum = parseFloat(purchasePrice.replace(',', '.'))
    const currentPriceNum = parseFloat(currentPrice.replace(',', '.'))

    if (!name.trim()) {
      setError('Введіть назву активу')
      return
    }
    if (!quantity || isNaN(quantityNum) || quantityNum <= 0) {
      setError('Введіть кількість більше 0')
      return
    }
    if (!purchasePrice || isNaN(purchasePriceNum) || purchasePriceNum < 0) {
      setError('Введіть ціну купівлі')
      return
    }
    if (!currentPrice || isNaN(currentPriceNum) || currentPriceNum < 0) {
      setError('Введіть поточну ціну')
      return
    }
    if (!user) {
      setError('Не вдалось визначити користувача')
      return
    }

    const formData = {
      name: name.trim(),
      type,
      quantity: quantityNum,
      purchasePrice: purchasePriceNum,
      currentPrice: currentPriceNum,
      currency,
      purchaseDate: new Date(purchaseDate),
      notes: notes.trim() || undefined,
    }

    try {
      if (isEdit && id) {
        await updateInvestment.mutateAsync({ id, data: formData })
      } else {
        await createInvestment.mutateAsync(formData)
      }
      navigate('/investments')
    } catch {
      setError('Не вдалось зберегти. Спробуй ще раз.')
    }
  }

  const handleDelete = async () => {
    if (!id) return
    await deleteInvestment.mutateAsync(id)
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
        <h1 className="text-lg font-semibold flex-1" style={{ color: 'var(--color-text-primary)' }}>
          {isEdit ? 'Редагувати актив' : 'Новий актив'}
        </h1>
        {isEdit && (
          <button onClick={() => setShowDeleteConfirm(true)} className="p-1">
            <Trash2 size={20} color="var(--color-expense)" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-5 py-5 px-4 overflow-y-auto flex-1">
        {/* ── Тип активу ────────────────────────────────────── */}
        <div>
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Тип активу
          </p>
          <div className="grid grid-cols-5 gap-2">
            {INVESTMENT_TYPES.map((t) => {
              const meta = INVESTMENT_TYPE_META[t]
              const isSelected = t === type
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div
                    className="rounded-full p-0.5 transition-all"
                    style={{
                      outline: isSelected ? `2px solid ${meta.colorHex}` : '2px solid transparent',
                      outlineOffset: 2,
                    }}
                  >
                    <CategoryIconCircle iconName={meta.iconName} colorHex={meta.colorHex} size="sm" />
                  </div>
                  <span
                    className="text-[10px] text-center leading-tight"
                    style={{ color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
                  >
                    {meta.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Назва ─────────────────────────────────────────── */}
        <Field label="Назва">
          <input
            type="text"
            placeholder="напр. Apple Inc., Bitcoin, ОВДП"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-base bg-transparent border-none outline-none"
            style={{ color: 'var(--color-text-primary)' }}
          />
        </Field>

        {/* ── Кількість + Валюта ────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Кількість">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value.replace(/[^0-9.,]/g, ''))}
              className="w-full text-base bg-transparent border-none outline-none"
              style={{ color: 'var(--color-text-primary)' }}
            />
          </Field>

          <Field label="Валюта">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full text-base bg-transparent border-none outline-none"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c} style={{ color: '#000' }}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* ── Ціна купівлі + поточна ціна ───────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <Field label={`Ціна купівлі (${currency})`}>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value.replace(/[^0-9.,]/g, ''))}
              className="w-full text-base bg-transparent border-none outline-none"
              style={{ color: 'var(--color-text-primary)' }}
            />
          </Field>

          <Field label={`Поточна ціна (${currency})`}>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={currentPrice}
              onChange={(e) => setCurrentPrice(e.target.value.replace(/[^0-9.,]/g, ''))}
              className="w-full text-base bg-transparent border-none outline-none"
              style={{ color: 'var(--color-text-primary)' }}
            />
          </Field>
        </div>

        {/* ── Дата купівлі ──────────────────────────────────── */}
        <Field label="Дата купівлі">
          <input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="w-full text-base bg-transparent border-none outline-none"
            style={{ color: 'var(--color-text-primary)', colorScheme: 'dark' }}
          />
        </Field>

        {/* ── Нотатки ───────────────────────────────────────── */}
        <Field label="Нотатки (необов'язково)">
          <input
            type="text"
            placeholder="напр. брокер, номер рахунку..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full text-sm bg-transparent border-none outline-none"
            style={{ color: 'var(--color-text-primary)' }}
          />
        </Field>

        {error && (
          <p className="text-sm" style={{ color: 'var(--color-expense)' }}>
            {error}
          </p>
        )}

        {/* ── Зберегти ──────────────────────────────────────── */}
        <div className="pb-4 mt-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-base transition-opacity disabled:opacity-60"
            style={{ backgroundColor: 'var(--color-accent)', color: '#1B2A2A' }}
          >
            <Check size={20} />
            {isSaving ? 'Зберігаємо...' : 'Зберегти'}
          </button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </p>
      {children}
      <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 8 }} />
    </div>
  )
}
