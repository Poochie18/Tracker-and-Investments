import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PlusCircle, TrendingUp } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useInvestments } from '@/hooks/use-investments'
import { Money, sumMoney } from '@/lib/utils/money'
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator'
import { AccountIconButton } from '@/components/AccountIconButton'
import { PortfolioSummaryCard } from './PortfolioSummaryCard'
import { InvestmentListItem } from './InvestmentListItem'
import { INVESTMENT_TYPE_META } from '../types'
import type { InvestmentType } from '@/lib/db/schema'

const VALID_TYPES: InvestmentType[] = ['stock', 'crypto', 'bond', 'deposit', 'other']

export function InvestmentsScreen() {
  const navigate = useNavigate()
  const { assetType } = useParams<{ assetType?: string }>()
  const activeType = VALID_TYPES.includes(assetType as InvestmentType)
    ? (assetType as InvestmentType)
    : null

  const { user } = useAuth()
  const { data: allInvestments = [], isLoading } = useInvestments(user?.id)

  const investments = useMemo(
    () => (activeType ? allInvestments.filter((i) => i.type === activeType) : allInvestments),
    [allInvestments, activeType]
  )

  // Портфель рахуємо в "умовних копійках" незалежно від валюти активу —
  // MVP не робить конвертацію валют, тому сума коректна лише якщо
  // всі активи в одній валюті (типовий кейс для одного користувача).
  const invested = sumMoney(
    investments.map((i) => Money.fromKopiyky(Math.round(i.purchase_price * i.quantity)))
  )
  const currentValue = sumMoney(
    investments.map((i) => Money.fromKopiyky(Math.round(i.current_price * i.quantity)))
  )
  const pnl = currentValue.subtract(invested)
  const pnlPercent = invested.isZero() ? 0 : (pnl.toKopiyky() / invested.toKopiyky()) * 100

  const addHref = activeType ? `/investments/add?type=${activeType}` : '/investments/add'
  const typeMeta = activeType ? INVESTMENT_TYPE_META[activeType] : null
  const emptyText = typeMeta
    ? `Ще немає жодного активу типу «${typeMeta.label}».`
    : 'Ще немає жодного активу. Додай перший — акцію, крипту, депозит чи облігацію.'

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
        <AccountIconButton />
        <h1 className="text-xl font-semibold flex-1" style={{ color: 'var(--color-text-primary)' }}>
          {typeMeta ? typeMeta.label : 'Інвестиції'}
        </h1>
        <SyncStatusIndicator />
      </div>

      <div className="flex flex-col gap-4 py-4 pb-24">
        {investments.length > 0 && (
          <PortfolioSummaryCard
            invested={invested}
            currentValue={currentValue}
            pnl={pnl}
            pnlPercent={pnlPercent}
          />
        )}

        <div className="px-4 flex flex-col gap-2">
          {!isLoading && investments.length === 0 && (
            <div
              className="flex flex-col items-center justify-center min-h-[50vh] gap-4"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <TrendingUp size={48} />
              <p className="text-center text-sm max-w-xs">{emptyText}</p>
              <button
                onClick={() => navigate(addHref)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm"
                style={{ backgroundColor: 'var(--color-accent)', color: '#1B2A2A' }}
              >
                <PlusCircle size={18} />
                Додати актив
              </button>
            </div>
          )}

          {investments.map((inv) => (
            <InvestmentListItem
              key={inv.id}
              investment={inv}
              onPress={() => navigate(`/investments/${inv.id}/edit`)}
            />
          ))}

          {investments.length > 0 && (
            <button
              onClick={() => navigate(addHref)}
              className="flex items-center justify-center gap-2 mt-2 py-3 rounded-2xl font-medium text-sm"
              style={{ backgroundColor: 'var(--color-bg-card)', color: 'var(--color-accent)' }}
            >
              <PlusCircle size={18} />
              Додати актив
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
