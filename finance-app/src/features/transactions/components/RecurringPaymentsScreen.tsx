import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { Repeat, Plus, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useAccounts } from '@/hooks/use-accounts'
import { useCategories } from '@/hooks/use-categories'
import {
  useRecurringPayments, useSetRecurringPaymentActive, useDeleteRecurringPayment,
} from '@/hooks/use-recurring-payments'
import { RECURRING_FREQUENCY_META, getNextDisplayDate } from '../recurring-schedule'
import { Switch } from '@/components/Switch'
import { CategoryIconCircle } from './CategoryIconCircle'
import { Money } from '@/lib/utils/money'

// Список регулярних платежів — шаблонів, з яких автоматично генеруються
// звичайні транзакції (use-recurring-auto-generate.ts + серверний cron).
// Тут можна редагувати (→ AddTransactionScreen у режимі шаблону),
// призупинити/відновити без видалення (Switch) і видалити (soft delete).
export function RecurringPaymentsScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: recurringPayments = [], isLoading } = useRecurringPayments(user?.id)
  const { data: accounts = [] } = useAccounts(user?.id)
  const { data: categories = [] } = useCategories(user?.id)
  const setActive = useSetRecurringPaymentActive(user?.id ?? '')
  const deleteRecurring = useDeleteRecurringPayment(user?.id ?? '')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const accountById = new Map(accounts.map((a) => [a.id, a]))
  const categoryById = new Map(categories.map((c) => [c.id, c]))

  // Активні згори, призупинені — знизу (притьмарені класом opacity нижче)
  const sorted = [...recurringPayments].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
    return a.name.localeCompare(b.name, 'uk')
  })

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
          Регулярні платежі
        </h1>
        <button
          type="button"
          onClick={() => navigate('/add?recurring=1')}
          className="p-1.5 rounded-full transition-opacity active:opacity-60"
          aria-label="Додати регулярний платіж"
          title="Додати регулярний платіж"
        >
          <Plus size={22} color="var(--color-accent)" />
        </button>
      </div>

      <div className="flex flex-col gap-2 px-4 py-4 pb-24">
        {!isLoading && recurringPayments.length === 0 && (
          <div
            className="flex flex-col items-center justify-center min-h-[50vh] gap-4"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <Repeat size={48} />
            <p className="text-center text-sm max-w-xs">
              Підписки, оренда, комунальні — додай через кнопку "+" вище або перемикач "Зробити регулярним" у новій
              транзакції.
            </p>
          </div>
        )}

        {sorted.map((r) => {
          const category = categoryById.get(r.category_id)
          const account = accountById.get(r.account_id)
          const nextDate = getNextDisplayDate(r)

          return (
            <div
              key={r.id}
              className="flex items-center gap-3 p-3 rounded-2xl transition-opacity"
              style={{ backgroundColor: 'var(--color-bg-card)', opacity: r.is_active ? 1 : 0.5 }}
            >
              {category && <CategoryIconCircle iconName={category.icon_name} colorHex={category.color_hex} size="md" />}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                  {r.name}
                </p>
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-secondary)' }}>
                  {RECURRING_FREQUENCY_META[r.frequency].label}
                  {account ? ` · ${account.name}` : ''}
                  {' · '}
                  {nextDate ? format(new Date(`${nextDate}T00:00:00`), 'd MMM yyyy', { locale: uk }) : 'завершено'}
                </p>
              </div>

              <p
                className="text-sm font-semibold flex-shrink-0"
                style={{ color: r.type === 'expense' ? 'var(--color-expense)' : 'var(--color-income)' }}
              >
                {r.type === 'expense' ? '−' : '+'}
                {Money.fromKopiyky(r.amount).formatWhole('₴')}
              </p>

              <button
                type="button"
                onClick={() => navigate(`/add?recurringId=${r.id}`)}
                className="p-1.5 flex-shrink-0"
                aria-label="Редагувати"
                title="Редагувати"
              >
                <Pencil size={16} color="var(--color-text-secondary)" />
              </button>

              <button
                type="button"
                onClick={() => setConfirmDeleteId(r.id)}
                className="p-1.5 flex-shrink-0"
                aria-label="Видалити"
                title="Видалити"
              >
                <Trash2 size={16} color="var(--color-expense)" />
              </button>

              <Switch checked={r.is_active} onChange={(v) => setActive.mutate({ id: r.id, isActive: v })} />
            </div>
          )
        })}
      </div>

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
              Видалити регулярний платіж?
            </p>
            <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
              Уже створені транзакції залишаться — видалиться лише сам розклад.
            </p>
            <button
              onClick={async () => {
                await deleteRecurring.mutateAsync(confirmDeleteId)
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
