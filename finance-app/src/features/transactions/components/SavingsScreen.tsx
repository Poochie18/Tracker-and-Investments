import { useState } from 'react'
import { PiggyBank, Plus, Pencil, Trash2, X } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useSavingsList, useCreateSavings, useUpdateSavings, useDeleteSavings } from '@/hooks/use-savings'
import { useExchangeRates } from '@/hooks/use-exchange-rates'
import { convertToUahMinorUnits, convertFromUahMinorUnits } from '@/lib/investments/exchange-rate'
import { Money } from '@/lib/utils/money'
import type { LocalSavings } from '@/lib/db/schema'

type DisplayCurrency = 'UAH' | 'USD' | 'EUR'

const CURRENCY_SYMBOL: Record<DisplayCurrency, string> = { UAH: '₴', USD: '$', EUR: '€' }

// Вкладка "Збереження" — готівкові заощадження в ГРН/USD/EUR, кожен
// "гаманець" тримає суму одразу в усіх трьох валютах (той самий патерн
// списку+форми, що й RecurringPaymentsScreen, тільки без категорій/рахунків).
// Загальна сума зверху перераховується в обрану валюту за курсом НБУ
// (exchange-rate.ts — той самий, що й перемикач валюти в інвестиціях).
export function SavingsScreen() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: savingsList = [], isLoading } = useSavingsList(user?.id)
  const { data: rates } = useExchangeRates()
  const createSavings = useCreateSavings(userId)
  const updateSavings = useUpdateSavings(userId)
  const deleteSavings = useDeleteSavings(userId)

  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('UAH')
  const [editTarget, setEditTarget] = useState<LocalSavings | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const totalUahMinor = rates
    ? savingsList.reduce(
        (sum, s) =>
          sum +
          convertToUahMinorUnits(s.amount_uah, 'UAH', rates) +
          convertToUahMinorUnits(s.amount_usd, 'USD', rates) +
          convertToUahMinorUnits(s.amount_eur, 'EUR', rates),
        0
      )
    : 0
  const totalDisplayMinor = rates ? convertFromUahMinorUnits(totalUahMinor, displayCurrency, rates) : 0

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      {/* ── Шапка ─────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 pb-4"
        style={{
          backgroundColor: 'var(--color-bg-header)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        }}
      >
        <h1 className="text-xl font-semibold flex-1" style={{ color: 'var(--color-text-primary)' }}>
          Збереження
        </h1>
        <button
          type="button"
          onClick={() => {
            setEditTarget(null)
            setShowForm(true)
          }}
          className="p-1.5 rounded-full transition-opacity active:opacity-60"
          aria-label="Додати збереження"
          title="Додати збереження"
        >
          <Plus size={22} color="var(--color-accent)" />
        </button>
      </div>

      <div className="flex flex-col gap-2 px-4 py-4 pb-24">
        {/* ── Картка загальної суми з перемикачем валюти ────── */}
        <div
          className="flex flex-col gap-3 p-4 rounded-2xl mb-2"
          style={{ backgroundColor: 'var(--color-bg-card)' }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Разом
            </p>
            <div className="flex rounded-xl p-1" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
              {(['UAH', 'USD', 'EUR'] as const).map((cur) => {
                const isActive = displayCurrency === cur
                return (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => setDisplayCurrency(cur)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
                    style={{
                      backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                      color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    }}
                  >
                    {cur}
                  </button>
                )
              })}
            </div>
          </div>
          <p className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {Money.fromKopiyky(totalDisplayMinor).formatCompact(CURRENCY_SYMBOL[displayCurrency])}
          </p>
          {rates?.date && (
            <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
              Курс НБУ на {rates.date}
            </p>
          )}
        </div>

        {!isLoading && savingsList.length === 0 && (
          <div
            className="flex flex-col items-center justify-center min-h-[40vh] gap-4"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <PiggyBank size={48} />
            <p className="text-center text-sm max-w-xs">
              Готівкові заощадження в гривні, доларах чи євро — додай через кнопку "+" вище.
            </p>
          </div>
        )}

        {savingsList.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-3 p-3 rounded-2xl"
            style={{ backgroundColor: 'var(--color-bg-card)' }}
          >
            <PiggyBank size={20} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                {s.name}
              </p>
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-secondary)' }}>
                {[
                  s.amount_uah !== 0 && Money.fromKopiyky(s.amount_uah).formatCompact('₴'),
                  s.amount_usd !== 0 && Money.fromKopiyky(s.amount_usd).formatCompact('$'),
                  s.amount_eur !== 0 && Money.fromKopiyky(s.amount_eur).formatCompact('€'),
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditTarget(s)
                setShowForm(true)
              }}
              className="p-1.5 flex-shrink-0"
              aria-label="Редагувати"
              title="Редагувати"
            >
              <Pencil size={16} color="var(--color-text-secondary)" />
            </button>

            <button
              type="button"
              onClick={() => setConfirmDeleteId(s.id)}
              className="p-1.5 flex-shrink-0"
              aria-label="Видалити"
              title="Видалити"
            >
              <Trash2 size={16} color="var(--color-expense)" />
            </button>
          </div>
        ))}
      </div>

      {/* ── Форма додавання/редагування ──────────────────────── */}
      {showForm && (
        <SavingsFormSheet
          initial={editTarget}
          onClose={() => setShowForm(false)}
          onSave={async (data) => {
            if (editTarget) {
              await updateSavings.mutateAsync({ id: editTarget.id, data })
            } else {
              await createSavings.mutateAsync(data)
            }
            setShowForm(false)
          }}
        />
      )}

      {/* ── Діалог підтвердження видалення ───────────────────── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={() => setConfirmDeleteId(null)}
          />
          <div
            className="relative w-full max-w-lg rounded-t-3xl p-6 pb-10 flex flex-col gap-4"
            style={{ backgroundColor: 'var(--color-bg-card)' }}
          >
            <p className="text-base font-semibold text-center" style={{ color: 'var(--color-text-primary)' }}>
              Видалити збереження?
            </p>
            <button
              onClick={async () => {
                await deleteSavings.mutateAsync(confirmDeleteId)
                setConfirmDeleteId(null)
              }}
              className="w-full py-3 rounded-2xl font-semibold text-sm"
              style={{ backgroundColor: 'var(--color-expense)', color: '#fff' }}
            >
              Видалити
            </button>
            <button
              onClick={() => setConfirmDeleteId(null)}
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

function SavingsFormSheet({
  initial,
  onClose,
  onSave,
}: {
  initial: LocalSavings | null
  onClose: () => void
  onSave: (data: { name: string; amount_uah: number; amount_usd: number; amount_eur: number }) => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [uah, setUah] = useState(initial ? (initial.amount_uah / 100).toString() : '')
  const [usd, setUsd] = useState(initial ? (initial.amount_usd / 100).toString() : '')
  const [eur, setEur] = useState(initial ? (initial.amount_eur / 100).toString() : '')
  const [saving, setSaving] = useState(false)

  const toMinor = (value: string): number => {
    const parsed = parseFloat(value.replace(',', '.'))
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        amount_uah: toMinor(uah),
        amount_usd: toMinor(usd),
        amount_eur: toMinor(eur),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-t-3xl p-6 pb-10 flex flex-col gap-4"
        style={{ backgroundColor: 'var(--color-bg-card)' }}
      >
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {initial ? 'Редагувати збереження' : 'Нове збереження'}
          </p>
          <button type="button" onClick={onClose} className="p-1">
            <X size={20} color="var(--color-text-secondary)" />
          </button>
        </div>

        <input
          type="text"
          placeholder="Назва, напр. Готівка вдома"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full text-sm px-3 py-2.5 rounded-xl bg-transparent border-none outline-none"
          style={{ color: 'var(--color-text-primary)', backgroundColor: 'rgba(255,255,255,0.06)' }}
        />

        {(
          [
            { label: '₴ Гривня', value: uah, setValue: setUah },
            { label: '$ Долар', value: usd, setValue: setUsd },
            { label: '€ Євро', value: eur, setValue: setEur },
          ] as const
        ).map(({ label, value, setValue }) => (
          <div key={label} className="flex items-center gap-3">
            <p className="text-xs w-20 flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
              {label}
            </p>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^0-9.,]/g, ''))}
              className="flex-1 text-sm px-3 py-2.5 rounded-xl bg-transparent border-none outline-none"
              style={{ color: 'var(--color-text-primary)', backgroundColor: 'rgba(255,255,255,0.06)' }}
            />
          </div>
        ))}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="w-full py-3 rounded-2xl font-semibold text-sm disabled:opacity-60"
          style={{ backgroundColor: 'var(--color-accent)', color: '#1B2A2A' }}
        >
          {saving ? 'Зберігаємо...' : 'Зберегти'}
        </button>
      </div>
    </div>
  )
}
