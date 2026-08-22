import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PlusCircle, TrendingUp } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useInvestments } from '@/hooks/use-investments'
import { useExchangeRates } from '@/hooks/use-exchange-rates'
import { Money, sumMoney } from '@/lib/utils/money'
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator'
import { AccountIconButton } from '@/components/AccountIconButton'
import { PortfolioSummaryCard } from './PortfolioSummaryCard'
import { InvestmentListItem } from './InvestmentListItem'
import { DepositListItem } from './DepositListItem'
import { PortfolioOverview } from './PortfolioOverview'
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
  const { data: rates } = useExchangeRates()

  // Тут сума рахується без конвертації валют — на вкладці одного типу
  // активи зазвичай в одній валюті (напр. усі акції в USD). Якщо activeType
  // немає (сторінка "Огляд"), масив порожній — той екран рендериться окремо.
  const investments = useMemo(
    () => (activeType ? allInvestments.filter((i) => i.type === activeType) : []),
    [allInvestments, activeType]
  )

  // "Огляд" (без activeType) має окрему логіку — зведена таблиця по типах
  // + графіки (аналог листа "Сводка" з Excel), а не список усіх активів підряд.
  if (!activeType) {
    return (
      <PortfolioOverview
        investments={allInvestments}
        rates={rates}
        isLoading={isLoading}
        onAddClick={() => navigate('/investments/add')}
      />
    )
  }

  const invested = sumMoney(
    investments.map((i) => Money.fromKopiyky(Math.round(i.purchase_price * i.quantity)))
  )
  const currentValue = sumMoney(
    investments.map((i) => Money.fromKopiyky(Math.round(i.current_price * i.quantity)))
  )
  const pnl = currentValue.subtract(invested)
  const pnlPercent = invested.isZero() ? 0 : (pnl.toKopiyky() / invested.toKopiyky()) * 100

  const addHref = `/investments/add?type=${activeType}`
  const typeMeta = INVESTMENT_TYPE_META[activeType]
  const emptyText = `Ще немає жодного активу типу «${typeMeta.label}».`

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
          {typeMeta.label}
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

          {investments.map((inv) =>
            activeType === 'deposit' ? (
              <DepositListItem key={inv.id} investment={inv} />
            ) : (
              <InvestmentListItem
                key={inv.id}
                investment={inv}
                onPress={() => navigate(`/investments/${inv.id}`)}
              />
            )
          )}

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
