import { useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { ArrowLeft, Check, Calculator, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useAccounts } from '@/hooks/use-accounts'
import { useCategoriesByType } from '@/hooks/use-categories'
import { useCreateTransaction, useUpdateTransaction, useTransaction } from '@/hooks/use-transactions'
import {
  useCreateRecurringPayment, useUpdateRecurringPayment, useRecurringPayment,
} from '@/hooks/use-recurring-payments'
import { RECURRING_FREQUENCIES, RECURRING_FREQUENCY_META } from '../recurring-schedule'
import { useUIStore } from '@/stores/ui-store'
import { Switch } from '@/components/Switch'
// Push-сповіщення поки закоментовано (див. onChange свіча нижче) —
// лишаємо тільки автоматичне додавання транзакції. Розкоментувати разом
// з push-subscribe.ts, коли знадобиться push.
// import { subscribeToPush } from '@/lib/notifications/push-subscribe'
import { CategoryIconCircle } from './CategoryIconCircle'
import { ExpenseIncomeTabs } from './ExpenseIncomeTabs'
import { QuickDateSelector } from './QuickDateSelector'
import { CalculatorKeyboard } from './CalculatorKeyboard'
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator'
import type { LocalTransaction, LocalRecurringPayment, RecurringFrequency, TransactionType } from '@/lib/db/schema'

// Кількість видимих рядків категорій за замовчуванням
const COLS = 4
const VISIBLE_ROWS = 2
const MAX_VISIBLE = COLS * VISIBLE_ROWS

const DATE_INPUT_STYLE = {
  backgroundColor: 'rgba(255,255,255,0.08)',
  color: 'var(--color-text-primary)',
  border: 'none',
  colorScheme: 'dark' as const,
}

function parseAmount(expr: string): number {
  const clean = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(',', '.')
  if (!/^[\d.+\-*/]+$/.test(clean)) return NaN
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${clean})`)() as unknown
    return typeof result === 'number' && isFinite(result) ? result : NaN
  } catch {
    return NaN
  }
}

// Обгортка-роутер: чекає завантаження транзакції/регулярного платежу при
// редагуванні (Dexie — асинхронний), а саму форму монтує з key={...} —
// тому TransactionForm ініціалізує свій стан напряму з даних, без setState
// всередині ефекту. Три режими: нова транзакція (id і recurringId відсутні,
// ?recurring=1 в URL — одразу вмикає свіч "Зробити регулярним"),
// редагування транзакції (id) і редагування шаблону регулярного платежу
// (recurringId, зі списку "Регулярні").
export function AddTransactionScreen() {
  const { id } = useParams<{ id?: string }>()
  const [searchParams] = useSearchParams()
  const recurringId = searchParams.get('recurringId') ?? undefined
  const startRecurring = searchParams.get('recurring') === '1'
  const isEdit = !!id
  const { data: existing, isLoading } = useTransaction(id)
  const { data: existingRecurring, isLoading: isLoadingRecurring } = useRecurringPayment(recurringId)

  if (isEdit && isLoading) return null
  if (recurringId && isLoadingRecurring) return null

  return (
    <TransactionForm
      key={id ?? recurringId ?? 'new'}
      id={id}
      existing={existing}
      recurringId={recurringId}
      existingRecurring={existingRecurring}
      startRecurring={startRecurring}
    />
  )
}

interface TransactionFormProps {
  id: string | undefined
  existing: LocalTransaction | undefined
  recurringId: string | undefined
  existingRecurring: LocalRecurringPayment | undefined
  startRecurring: boolean
}

function TransactionForm({ id, existing, recurringId, existingRecurring, startRecurring }: TransactionFormProps) {
  const navigate = useNavigate()
  const isEdit = !!id
  const isRecurringTemplate = !!recurringId
  const { user } = useAuth()
  const { data: accounts = [] } = useAccounts(user?.id)
  const globalSelectedAccountId = useUIStore((s) => s.selectedAccountId)
  const createTransaction = useCreateTransaction(user?.id ?? '')
  const updateTransaction = useUpdateTransaction(user?.id ?? '')
  const createRecurring = useCreateRecurringPayment(user?.id ?? '')
  const updateRecurring = useUpdateRecurringPayment(user?.id ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  // Спільні поля (тип/рахунок/сума/категорія/коментар) заповнюються і зі
  // звичайної транзакції, і з шаблону регулярного платежу — обидва мають
  // однакову форму цих полів.
  const seed = existingRecurring ?? existing

  const [type, setType] = useState<TransactionType>(seed?.type ?? 'expense')
  // undefined, поки користувач не тапнув інший рахунок вручну — тоді
  // діючий рахунок обчислюється нижче з живих даних (accounts може
  // довантажитись пізніше за перший рендер, тож не фіксуємо в useState).
  const [manualAccountId, setManualAccountId] = useState<string | undefined>(seed?.account_id)
  const selectedAccountId =
    manualAccountId ?? accounts.find((a) => a.id === globalSelectedAccountId)?.id ?? accounts[0]?.id
  const [amountStr, setAmountStr] = useState(seed ? String(seed.amount / 100) : '')
  const [showCalc, setShowCalc] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(seed?.category_id ?? null)
  const [categoriesExpanded, setCategoriesExpanded] = useState(false)
  const [date, setDate] = useState<Date>(existing ? new Date(existing.date) : new Date())
  const [comment, setComment] = useState(seed?.comment ?? '')
  const [error, setError] = useState<string | null>(null)

  // ── Регулярний платіж ────────────────────────────────────────────
  const [isRecurring, setIsRecurring] = useState(isRecurringTemplate || startRecurring)
  const [recurringName, setRecurringName] = useState(existingRecurring?.name ?? '')
  const [frequency, setFrequency] = useState<RecurringFrequency>(existingRecurring?.frequency ?? 'monthly')
  const [startDate, setStartDate] = useState(
    existingRecurring ? existingRecurring.start_date.slice(0, 10) : format(new Date(), 'yyyy-MM-dd')
  )
  const [startTime, setStartTime] = useState(existingRecurring?.start_time ?? '09:00')
  const [hasEndDate, setHasEndDate] = useState(!!existingRecurring?.end_date)
  const [endDate, setEndDate] = useState(existingRecurring?.end_date?.slice(0, 10) ?? '')

  const { data: categories = [] } = useCategoriesByType(user?.id, type)
  const visibleCategories = categoriesExpanded ? categories : categories.slice(0, MAX_VISIBLE)
  const hasMore = categories.length > MAX_VISIBLE
  const isSaving =
    createTransaction.isPending || updateTransaction.isPending || createRecurring.isPending || updateRecurring.isPending

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType)
    setSelectedCategoryId(null)
    setCategoriesExpanded(false)
  }

  const toggleCalc = () => {
    setShowCalc((v) => {
      const next = !v
      // Якщо закриваємо калькулятор — фокусуємо поле вводу
      if (!next) {
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      return next
    })
  }

  const handleSave = async () => {
    setError(null)
    const amountUah = parseAmount(amountStr)

    if (!amountStr || isNaN(amountUah) || amountUah <= 0) {
      setError('Введіть суму більше 0')
      return
    }
    if (!selectedCategoryId) {
      setError('Оберіть категорію')
      return
    }
    if (!selectedAccountId || !user) {
      setError('Рахунок не знайдено')
      return
    }
    if ((isRecurring || isRecurringTemplate) && !recurringName.trim()) {
      setError('Введіть назву регулярного платежу')
      return
    }

    const amountKopiyky = Math.round(amountUah * 100)

    try {
      if (isRecurringTemplate && recurringId) {
        await updateRecurring.mutateAsync({
          id: recurringId,
          data: {
            name: recurringName.trim(),
            type,
            amount: amountKopiyky,
            category_id: selectedCategoryId,
            account_id: selectedAccountId,
            comment: comment.trim() || undefined,
            frequency,
            start_date: startDate,
            start_time: startTime,
            end_date: hasEndDate ? endDate || null : null,
          },
        })
        navigate('/recurring')
      } else if (isEdit && id) {
        await updateTransaction.mutateAsync({
          id,
          data: {
            account_id: selectedAccountId,
            category_id: selectedCategoryId,
            type,
            amount: amountKopiyky,
            date: date.toISOString(),
            comment: comment.trim() || undefined,
          },
        })
        navigate(-1)
      } else if (isRecurring) {
        await createRecurring.mutateAsync({
          name: recurringName.trim(),
          type,
          amount: amountKopiyky,
          category_id: selectedCategoryId,
          account_id: selectedAccountId,
          comment: comment.trim() || undefined,
          frequency,
          start_date: startDate,
          start_time: startTime,
          end_date: hasEndDate ? endDate || null : null,
        })
        navigate('/recurring')
      } else {
        await createTransaction.mutateAsync({
          account_id: selectedAccountId,
          category_id: selectedCategoryId,
          type,
          amount: amountKopiyky,
          date,
          comment: comment.trim() || undefined,
        })
        navigate('/overview')
      }
    } catch {
      setError('Не вдалось зберегти. Спробуй ще раз.')
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
          {isRecurringTemplate ? 'Регулярний платіж' : isEdit ? 'Редагувати транзакцію' : 'Нова транзакція'}
        </h1>
        <SyncStatusIndicator />
      </div>

      <div className="flex flex-col gap-5 py-5 overflow-y-auto flex-1">
        {/* ── Тип ───────────────────────────────────────────── */}
        <div className="px-4">
          <ExpenseIncomeTabs active={type} onChange={handleTypeChange} />
        </div>

        {/* ── Рахунок (тільки якщо їх декілька) ────────────── */}
        {accounts.length > 1 && (
          <div className="px-4">
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Рахунок
            </p>
            <div className="flex gap-2 flex-wrap">
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setManualAccountId(acc.id)}
                  className="px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
                  style={{
                    backgroundColor: acc.id === selectedAccountId ? 'var(--color-accent)' : 'var(--color-bg-card)',
                    color: acc.id === selectedAccountId ? '#1B2A2A' : 'var(--color-text-secondary)',
                  }}
                >
                  {acc.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Сума + перемикач калькулятора ────────────────── */}
        <div className="px-4">
          <div className="flex items-end justify-between mb-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                Сума (₴)
              </p>
              {/* input завжди присутній; readOnly коли відкритий калькулятор */}
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={amountStr}
                readOnly={showCalc}
                onChange={(e) => {
                  // Дозволяємо тільки цифри, крапку та оператори
                  const val = e.target.value.replace(/[^0-9.+\-×÷*/]/g, '')
                  setAmountStr(val)
                }}
                className="w-full text-4xl font-bold bg-transparent border-none outline-none"
                style={{
                  color: amountStr ? 'var(--color-text-primary)' : 'rgba(255,255,255,0.2)',
                }}
              />
            </div>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault()
                toggleCalc()
              }}
              className="mb-1 p-2 rounded-xl transition-all flex-shrink-0"
              style={{
                backgroundColor: showCalc ? 'var(--color-accent)' : 'var(--color-bg-card)',
                color: showCalc ? '#1B2A2A' : 'var(--color-text-secondary)',
              }}
            >
              <Calculator size={20} />
            </button>
          </div>
          <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)' }} />
        </div>

        {/* ── Калькулятор (випадний) ────────────────────────── */}
        {showCalc && (
          <div className="pb-1">
            <CalculatorKeyboard value={amountStr} onChange={setAmountStr} />
          </div>
        )}

        {/* ── Категорії ─────────────────────────────────────── */}
        <div className="px-4">
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Категорія
          </p>
          {categories.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Категорії не знайдені
            </p>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3">
                {visibleCategories.map((cat) => {
                  const isSelected = cat.id === selectedCategoryId
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <div
                        className="rounded-full p-0.5 transition-all"
                        style={{
                          outline: isSelected ? `2px solid ${cat.color_hex}` : '2px solid transparent',
                          outlineOffset: 2,
                        }}
                      >
                        <CategoryIconCircle
                          iconName={cat.icon_name}
                          colorHex={cat.color_hex}
                          size="md"
                        />
                      </div>
                      <span
                        className="text-xs text-center leading-tight line-clamp-2"
                        style={{
                          color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                        }}
                      >
                        {cat.name}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Кнопка розгорнути / згорнути */}
              {hasMore && (
                <button
                  type="button"
                  onClick={() => setCategoriesExpanded((v) => !v)}
                  className="flex items-center justify-center gap-1 w-full mt-3 py-2 rounded-xl text-xs font-medium"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {categoriesExpanded ? (
                    <>
                      <ChevronUp size={14} /> Згорнути
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} /> Ще {categories.length - MAX_VISIBLE} категорій
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Зробити регулярним (тільки для нової транзакції) ── */}
        {!isEdit && !isRecurringTemplate && (
          <div className="px-4">
            <Switch
              checked={isRecurring}
              onChange={(v) => {
                setIsRecurring(v)
                // Push-сповіщення поки вимкнено — тільки автоматичне
                // додавання транзакції (без запиту дозволу на нотифікації).
                // if (v && user?.id) void subscribeToPush(user.id)
              }}
              label="Зробити регулярним"
            />
          </div>
        )}

        {/* ── Регулярний платіж: назва/частота/розклад — АБО звичайна дата ── */}
        {isRecurring || isRecurringTemplate ? (
          <div className="px-4 flex flex-col gap-4">
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Назва платежу
              </p>
              <input
                type="text"
                placeholder="напр. Оренда квартири"
                value={recurringName}
                onChange={(e) => setRecurringName(e.target.value)}
                className="w-full text-sm bg-transparent border-none outline-none"
                style={{ color: 'var(--color-text-primary)' }}
              />
              <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 8 }} />
            </div>

            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Частота нагадування
              </p>
              <div className="flex flex-wrap gap-2">
                {RECURRING_FREQUENCIES.map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => setFrequency(freq)}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                    style={{
                      backgroundColor: frequency === freq ? 'var(--color-accent)' : 'var(--color-bg-card)',
                      color: frequency === freq ? '#1B2A2A' : 'var(--color-text-secondary)',
                    }}
                  >
                    {RECURRING_FREQUENCY_META[freq].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Дата початку
                </p>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-xl text-xs"
                  style={DATE_INPUT_STYLE}
                />
              </div>
              <div style={{ width: 110 }}>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Час
                </p>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-xl text-xs"
                  style={DATE_INPUT_STYLE}
                />
              </div>
            </div>

            <div>
              <Switch checked={!hasEndDate} onChange={(v) => setHasEndDate(!v)} label="Без дати завершення" />
              {hasEndDate && (
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full mt-2 px-2 py-1.5 rounded-xl text-xs"
                  style={DATE_INPUT_STYLE}
                />
              )}
            </div>
          </div>
        ) : (
          <QuickDateSelector value={date} onChange={setDate} />
        )}

        {/* ── Коментар ──────────────────────────────────────── */}
        <div className="px-4">
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Коментар (необов'язково)
          </p>
          <input
            type="text"
            placeholder="Додати коментар..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full text-sm bg-transparent border-none outline-none"
            style={{ color: 'var(--color-text-primary)' }}
          />
          <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 8 }} />
        </div>

        {error && (
          <p className="px-4 text-sm" style={{ color: 'var(--color-expense)' }}>
            {error}
          </p>
        )}

        {/* ── Зберегти ──────────────────────────────────────── */}
        <div className="px-4 pb-4">
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
