import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useInvestments } from '@/hooks/use-investments'
import { useExchangeRates } from '@/hooks/use-exchange-rates'
import { useAllDepositContributions } from '@/hooks/use-deposit-contributions'
import { useAllBondCouponDates } from '@/hooks/use-bond-coupon-dates'
import { useAllBondLots } from '@/hooks/use-bond-lots'
import { Money, sumMoney } from '@/lib/utils/money'
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator'
import { AccountIconButton } from '@/components/AccountIconButton'
import { PortfolioSummaryCard } from './PortfolioSummaryCard'
import { InvestmentListItem } from './InvestmentListItem'
import { DepositListItem } from './DepositListItem'
import { BondListItem } from './BondListItem'
import { BondFiscalYearTable } from './BondFiscalYearTable'
import { PortfolioOverview } from './PortfolioOverview'
import { computeDepositTotals } from '../deposit-schedule'
import { computeBondTotals } from '../bond-schedule'
import { useFiscalYearStartMonth } from '@/lib/settings/fiscal-year'
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
  const { data: depositContributions = [] } = useAllDepositContributions(user?.id)
  const { data: bondCouponDates = [] } = useAllBondCouponDates(user?.id)
  const { data: bondLots = [] } = useAllBondLots(user?.id)
  const fiscalYearStartMonth = useFiscalYearStartMonth()

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
      />
    )
  }

  // Для депозитів: "вкладено" — початковий внесок + усі поповнення за строк,
  // "поточна вартість" — сума на кінець останнього місяця строку (з відсотками).
  const depositTotalsById = new Map(
    investments
      .filter((i) => i.type === 'deposit')
      .map((i) => [
        i.id,
        computeDepositTotals(i, depositContributions.filter((c) => c.investment_id === i.id)),
      ])
  )

  // Для облігацій: "поточна вартість" — вкладено + всі купонні виплати за
  // весь строк (прибуток облігації = сума купонів, не приріст ціни).
  const bondTotalsById = new Map(
    investments
      .filter((i) => i.type === 'bond')
      .map((i) => [
        i.id,
        computeBondTotals(
          i,
          bondCouponDates.filter((d) => d.investment_id === i.id),
          bondLots.filter((l) => l.investment_id === i.id)
        ),
      ])
  )

  const investedRaw = (i: (typeof investments)[number]) => {
    if (i.type === 'deposit') return depositTotalsById.get(i.id)!.invested
    if (i.type === 'bond') return bondTotalsById.get(i.id)!.invested
    return Math.round(i.purchase_price * i.quantity)
  }
  const currentRaw = (i: (typeof investments)[number]) => {
    if (i.type === 'deposit') return depositTotalsById.get(i.id)!.currentValue
    if (i.type === 'bond') return bondTotalsById.get(i.id)!.currentValue
    return Math.round(i.current_price * i.quantity)
  }

  const invested = sumMoney(investments.map((i) => Money.fromKopiyky(investedRaw(i))))
  const currentValue = sumMoney(investments.map((i) => Money.fromKopiyky(currentRaw(i))))
  const pnl = currentValue.subtract(invested)
  const pnlPercent = invested.isZero() ? 0 : (pnl.toKopiyky() / invested.toKopiyky()) * 100

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
        {investments.length > 0 && activeType === 'bond' && rates ? (
          <div className="mx-4 flex gap-3 items-stretch">
            <PortfolioSummaryCard
              invested={invested}
              currentValue={currentValue}
              pnl={pnl}
              pnlPercent={pnlPercent}
              stacked
              className="flex-1"
            />
            <div className="flex-1 p-4 rounded-3xl" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <BondFiscalYearTable
                bonds={investments}
                bondCouponDates={bondCouponDates}
                bondLots={bondLots}
                rates={rates}
                fiscalYearStartMonth={fiscalYearStartMonth}
              />
            </div>
          </div>
        ) : (
          investments.length > 0 && (
            <PortfolioSummaryCard
              invested={invested}
              currentValue={currentValue}
              pnl={pnl}
              pnlPercent={pnlPercent}
            />
          )
        )}

        <div className="px-4 flex flex-col gap-2">
          {!isLoading && investments.length === 0 && (
            <div
              className="flex flex-col items-center justify-center min-h-[50vh] gap-4"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <TrendingUp size={48} />
              <p className="text-center text-sm max-w-xs">{emptyText}</p>
            </div>
          )}

          {investments.map((inv) => {
            if (activeType === 'deposit') return <DepositListItem key={inv.id} investment={inv} />
            if (activeType === 'bond') return <BondListItem key={inv.id} investment={inv} />
            return (
              <InvestmentListItem
                key={inv.id}
                investment={inv}
                onPress={() => navigate(`/investments/${inv.id}`)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
