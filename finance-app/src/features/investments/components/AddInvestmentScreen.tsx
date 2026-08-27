import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Plus, X } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useInvestment, useCreateInvestment, useUpdateInvestment } from '@/hooks/use-investments'
import { useBondCouponDates, bondCouponDateKeys } from '@/hooks/use-bond-coupon-dates'
import { bondCouponDatesRepo } from '../repositories/bond-coupon-dates-repo'
import { CategoryIconCircle } from '@/features/transactions/components/CategoryIconCircle'
import { ADDABLE_INVESTMENT_TYPES, INVESTMENT_TYPE_META } from '../types'
import type { InvestmentType, LocalInvestment } from '@/lib/db/schema'

const CURRENCIES = ['UAH', 'USD', 'EUR']

// Обгортка-роутер: чекає завантаження активу (і, для облігацій, дат виплат)
// при редагуванні (Dexie — асинхронний), а саму форму монтує з key={id ?? 'new'} —
// тому InvestmentForm ініціалізує свій стан напряму з даних, без setState
// всередині ефекту.
export function AddInvestmentScreen() {
  const { id } = useParams<{ id?: string }>()
  const [searchParams] = useSearchParams()
  const isEdit = !!id
  const { data: existing, isLoading } = useInvestment(id)
  const { data: existingDates, isLoading: datesLoading } = useBondCouponDates(id)

  // При редагуванні чекаємо поки Dexie віддасть запис (і дати виплат,
  // якщо це облігація) — інакше форма на мить змонтується порожньою
  // і одразу перемонтується.
  if (isEdit && (isLoading || datesLoading)) return null

  // ?type=deposit — коли додаємо актив із конкретної вкладки розділу
  // (напр. "Депозити"), одразу підставляємо цей тип у форму.
  const defaultTypeParam = searchParams.get('type')
  const defaultType = ADDABLE_INVESTMENT_TYPES.includes(defaultTypeParam as InvestmentType)
    ? (defaultTypeParam as InvestmentType)
    : undefined

  return (
    <InvestmentForm
      key={id ?? 'new'}
      id={id}
      existing={existing}
      existingCouponDates={existingDates ?? []}
      defaultType={defaultType}
    />
  )
}

interface InvestmentFormProps {
  id: string | undefined
  existing: LocalInvestment | undefined
  existingCouponDates: { payment_date: string }[]
  defaultType?: InvestmentType
}

function InvestmentForm({ id, existing, existingCouponDates, defaultType }: InvestmentFormProps) {
  const navigate = useNavigate()
  const isEdit = !!id

  const { user } = useAuth()
  const createInvestment = useCreateInvestment(user?.id ?? '')
  const updateInvestment = useUpdateInvestment(user?.id ?? '')
  const queryClient = useQueryClient()

  const [name, setName] = useState(existing?.name ?? '')
  const [type, setType] = useState<InvestmentType>(existing?.type ?? defaultType ?? 'stock')
  // Для облігацій, що редагуються, "Кількість"/"Ціна купівлі"/"Дата купівлі"
  // — похідні значення від партій (bond_lots, керуються через BondListItem/
  // BondLotSheet), тому тут заблоковані (bondFieldsLocked нижче).
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
  const [interestRate, setInterestRate] = useState(
    existing?.interest_rate_percent != null ? String(existing.interest_rate_percent) : ''
  )
  const [termMonths, setTermMonths] = useState(
    existing?.term_months != null ? String(existing.term_months) : ''
  )
  const [couponAmount, setCouponAmount] = useState(
    existing?.coupon_amount != null ? String(existing.coupon_amount / 100) : ''
  )
  const [redemptionAmount, setRedemptionAmount] = useState(
    existing?.redemption_amount != null ? String(existing.redemption_amount / 100) : ''
  )
  const [redemptionDate, setRedemptionDate] = useState(
    existing?.redemption_date?.slice(0, 10) ?? ''
  )
  const [couponDates, setCouponDates_] = useState<string[]>(
    existingCouponDates.map((d) => d.payment_date.slice(0, 10))
  )
  const [tickerSymbol, setTickerSymbol] = useState(existing?.ticker_symbol ?? '')
  const [error, setError] = useState<string | null>(null)

  const isSaving = createInvestment.isPending || updateInvestment.isPending
  const isBond = type === 'bond'
  // "Кількість"/"Ціна купівлі"/"Дата купівлі" для облігацій, що
  // редагуються, теж доступні для правки напряму — окремо від партій
  // (bond_lots), керованих через BondListItem → "Докупити"/тап на партію.
  const bondFieldsLocked = false

  const addCouponDate = () => setCouponDates_((prev) => [...prev, new Date().toISOString().slice(0, 10)])
  const updateCouponDate = (index: number, value: string) =>
    setCouponDates_((prev) => prev.map((d, i) => (i === index ? value : d)))
  const removeCouponDate = (index: number) =>
    setCouponDates_((prev) => prev.filter((_, i) => i !== index))

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
    // Для облігацій поточну ціну не вводимо (тримаємо до погашення за номіналом)
    if (!isBond && (!currentPrice || isNaN(currentPriceNum) || currentPriceNum < 0)) {
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
      currentPrice: isBond ? purchasePriceNum : currentPriceNum,
      currency,
      purchaseDate: new Date(purchaseDate),
      notes: notes.trim() || undefined,
      interestRatePercent: type === 'deposit' && interestRate ? parseFloat(interestRate.replace(',', '.')) : undefined,
      termMonths: type === 'deposit' && termMonths ? parseInt(termMonths, 10) : undefined,
      couponAmount: isBond && couponAmount ? parseFloat(couponAmount.replace(',', '.')) : undefined,
      redemptionAmount: isBond && redemptionAmount ? parseFloat(redemptionAmount.replace(',', '.')) : undefined,
      redemptionDate: isBond && redemptionDate ? new Date(redemptionDate) : undefined,
      tickerSymbol: type === 'stock' && tickerSymbol.trim() ? tickerSymbol.trim() : undefined,
    }

    try {
      let investmentId = id
      if (isEdit && id) {
        await updateInvestment.mutateAsync({ id, data: formData })
      } else {
        const created = await createInvestment.mutateAsync(formData)
        investmentId = created.id
      }

      // Дати виплат зберігаємо окремо — тільки для облігацій, і тільки
      // якщо список змінювався (для нового активу зберігаємо завжди, якщо є дати).
      if (isBond && investmentId) {
        await bondCouponDatesRepo.replaceAll(user.id, investmentId, couponDates.filter(Boolean))
        void queryClient.invalidateQueries({ queryKey: bondCouponDateKeys.byInvestment(investmentId) })
        void queryClient.invalidateQueries({ queryKey: bondCouponDateKeys.all(user.id) })
      }

      // Повертаємось на вкладку саме цього типу активу — зберігає контекст,
      // якщо додавали/редагували, наприклад, з вкладки "Депозити".
      navigate(`/investments/type/${type}`)
    } catch (e) {
      // Показуємо реальний текст помилки (Dexie constraint, quota тощо) —
      // без цього незрозуміло, чи запис взагалі не створився локально,
      // чи проблема лише в подальшій відправці в Supabase.
      const message = e instanceof Error ? e.message : String(e)
      setError(`Не вдалось зберегти: ${message}`)
    }
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
      </div>

      <div className="flex flex-col gap-5 py-5 px-4 overflow-y-auto flex-1">
        {/* ── Тип активу ────────────────────────────────────── */}
        <div>
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Тип активу
          </p>
          <div className="grid grid-cols-4 gap-2">
            {ADDABLE_INVESTMENT_TYPES.map((t) => {
              const meta = INVESTMENT_TYPE_META[t]
              const isSelected = t === type
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t)
                    // Валюта за замовчуванням для нового активу — акції й
                    // крипта зазвичай ведуться в доларах, решта в гривні.
                    // При редагуванні існуючого активу валюту не чіпаємо.
                    if (!isEdit) setCurrency(t === 'stock' || t === 'crypto' ? 'USD' : 'UAH')
                  }}
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

        {/* ── Тікер (тільки для акцій) — за ним підтягується поточна ціна ── */}
        {type === 'stock' && (
          <Field label="Тікер (для автопідтягування ціни)">
            <input
              type="text"
              placeholder="напр. AAPL"
              value={tickerSymbol}
              onChange={(e) => setTickerSymbol(e.target.value.toUpperCase())}
              className="w-full text-base bg-transparent border-none outline-none"
              style={{ color: 'var(--color-text-primary)' }}
            />
          </Field>
        )}

        {/* ── Кількість + Валюта ───────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Кількість" disabled={bondFieldsLocked}>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value.replace(/[^0-9.,]/g, ''))}
              disabled={bondFieldsLocked}
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

        {/* ── Ціна купівлі + поточна ціна (для облігацій поточна ціна не
             потрібна — тримаємо до погашення за номіналом) ──────────── */}
        <div className="grid grid-cols-2 gap-4">
          <Field label={`Ціна купівлі (середня, ${currency})`} disabled={bondFieldsLocked}>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value.replace(/[^0-9.,]/g, ''))}
              disabled={bondFieldsLocked}
              className="w-full text-base bg-transparent border-none outline-none"
              style={{ color: 'var(--color-text-primary)' }}
            />
          </Field>

          {type === 'bond' ? (
            <Field label={`Сума погашення за 1 шт (${currency})`}>
              <input
                type="text"
                inputMode="decimal"
                placeholder="напр. 1000"
                value={redemptionAmount}
                onChange={(e) => setRedemptionAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
                className="w-full text-base bg-transparent border-none outline-none"
                style={{ color: 'var(--color-text-primary)' }}
              />
            </Field>
          ) : (
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
          )}
        </div>

        {/* ── Ставка + строк вкладу (тільки для депозитів) ──── */}
        {type === 'deposit' && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Річна ставка, %">
              <input
                type="text"
                inputMode="decimal"
                placeholder="напр. 12.32"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value.replace(/[^0-9.,]/g, ''))}
                className="w-full text-base bg-transparent border-none outline-none"
                style={{ color: 'var(--color-text-primary)' }}
              />
            </Field>

            <Field label="Строк, місяців">
              <input
                type="text"
                inputMode="numeric"
                placeholder="напр. 12"
                value={termMonths}
                onChange={(e) => setTermMonths(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full text-base bg-transparent border-none outline-none"
                style={{ color: 'var(--color-text-primary)' }}
              />
            </Field>
          </div>
        )}

        {/* ── Дата купівлі + дата погашення (для облігацій) ──── */}
        <div className={type === 'bond' ? 'grid grid-cols-2 gap-4' : ''}>
          <Field label="Дата купівлі" disabled={bondFieldsLocked}>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              disabled={bondFieldsLocked}
              className="w-full text-base bg-transparent border-none outline-none"
              style={{ color: 'var(--color-text-primary)', colorScheme: 'dark' }}
            />
          </Field>

          {type === 'bond' && (
            <Field label="Дата погашення">
              <input
                type="date"
                value={redemptionDate}
                onChange={(e) => setRedemptionDate(e.target.value)}
                className="w-full text-base bg-transparent border-none outline-none"
                style={{ color: 'var(--color-text-primary)', colorScheme: 'dark' }}
              />
            </Field>
          )}
        </div>

        {/* ── Ціна купону за 1 шт (тільки для облігацій) ──────── */}
        {type === 'bond' && (
          <Field label={`Ціна купону за 1 шт (${currency})`}>
            <input
              type="text"
              inputMode="decimal"
              placeholder="напр. 81.75"
              value={couponAmount}
              onChange={(e) => setCouponAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
              className="w-full text-base bg-transparent border-none outline-none"
              style={{ color: 'var(--color-text-primary)' }}
            />
          </Field>
        )}

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

        {/* ── Дати виплат купонів (тільки для облігацій) ──────── */}
        {type === 'bond' && (
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Дати виплат купонів
            </p>
            <div className="flex flex-col gap-2">
              {couponDates.map((date, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => updateCouponDate(index, e.target.value)}
                    className="flex-1 text-sm bg-transparent border-none outline-none px-3 py-2 rounded-xl"
                    style={{ color: 'var(--color-text-primary)', colorScheme: 'dark', backgroundColor: 'rgba(255,255,255,0.06)' }}
                  />
                  <button
                    type="button"
                    onClick={() => removeCouponDate(index)}
                    className="p-2 rounded-xl"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                  >
                    <X size={16} color="var(--color-expense)" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addCouponDate}
              className="flex items-center gap-1.5 mt-2 px-3 py-2 rounded-xl text-xs font-medium"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--color-accent)' }}
            >
              <Plus size={14} />
              Додати дату
            </button>
          </div>
        )}

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
    </div>
  )
}

// disabled — тільки візуальне притлумлення (для режиму "докупити"); сам
// <input>/<select> всередині все одно потребує свого атрибута disabled.
function Field({ label, children, disabled }: { label: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <div style={{ opacity: disabled ? 0.5 : 1 }}>
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </p>
      {children}
      <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 8 }} />
    </div>
  )
}
