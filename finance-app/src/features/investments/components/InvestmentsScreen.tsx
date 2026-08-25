import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TrendingUp, ChevronDown, ChevronUp, KeyRound, ChevronRight } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useInvestments, useScaleCryptoInvested } from '@/hooks/use-investments'
import { useBinanceConnectionStatus, useCleanupOrphanedCryptoSync } from '@/hooks/use-crypto-exchange'
import { useExchangeRates } from '@/hooks/use-exchange-rates'
import { useAllDepositContributions } from '@/hooks/use-deposit-contributions'
import { useAllBondCouponDates } from '@/hooks/use-bond-coupon-dates'
import { useAllBondLots } from '@/hooks/use-bond-lots'
import { Money } from '@/lib/utils/money'
import { convertToUahMinorUnits } from '@/lib/investments/exchange-rate'
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator'
import { AccountIconButton } from '@/components/AccountIconButton'
import { PortfolioSummaryCard } from './PortfolioSummaryCard'
import { InvestmentListItem } from './InvestmentListItem'
import { CryptoListItem } from './CryptoListItem'
import { DepositListItem } from './DepositListItem'
import { BondListItem } from './BondListItem'
import { CryptoSyncButton } from './CryptoSyncButton'
import { EditCryptoInvestedModal } from './EditCryptoInvestedModal'
import { BondFiscalYearTable } from './BondFiscalYearTable'
import { PortfolioOverview } from './PortfolioOverview'
import { computeDepositTotals } from '../deposit-schedule'
import { computeBondTotals } from '../bond-schedule'
import { useFiscalYearStartMonth } from '@/lib/settings/fiscal-year'
import { INVESTMENT_TYPE_META } from '../types'
import type { InvestmentType } from '@/lib/db/schema'

// Дрібні монети (менше цієї суми поточної вартості) на вкладці "Крипта"
// згортаємо під "Показати ще N" — типово це пил (комісії, залишки
// конвертацій), який лише захаращує список.
const CRYPTO_DUST_THRESHOLD_USD = 50

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
  const { data: binanceStatus } = useBinanceConnectionStatus()
  useCleanupOrphanedCryptoSync(user?.id, activeType === 'crypto')
  const [showDust, setShowDust] = useState(false)
  const [showEditInvested, setShowEditInvested] = useState(false)
  const scaleCryptoInvested = useScaleCryptoInvested(user?.id ?? '')

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

  // currentRaw — лише для сортування списку і фільтра пилу (<$50 на
  // крипті); округлення по кожному активу окремо тут не критичне, воно
  // впливає лише на порядок/поріг показу, не на суму.
  const currentRaw = (i: (typeof investments)[number]) => {
    if (i.type === 'deposit') return depositTotalsById.get(i.id)!.currentValue
    if (i.type === 'bond') return bondTotalsById.get(i.id)!.currentValue
    return Math.round(i.current_price * i.quantity)
  }

  // Підсумок (для картки зверху) рахуємо округленням СУМИ, а не сумою
  // округлених по кожному активу значень — для крипти purchase_price/
  // current_price дробові (NUMERIC, не цілі копійки), і Math.round() по
  // кожній монеті окремо накопичував би похибку в кілька копійок на
  // десятках монет: вводиш "6456" у пенсіл — а підсумок показує "6456,03".
  const investedTotalRaw = investments.reduce((sum, i) => {
    if (i.type === 'deposit') return sum + depositTotalsById.get(i.id)!.invested
    if (i.type === 'bond') return sum + bondTotalsById.get(i.id)!.invested
    return sum + i.purchase_price * i.quantity
  }, 0)
  const currentTotalRaw = investments.reduce((sum, i) => {
    if (i.type === 'deposit') return sum + depositTotalsById.get(i.id)!.currentValue
    if (i.type === 'bond') return sum + bondTotalsById.get(i.id)!.currentValue
    return sum + i.current_price * i.quantity
  }, 0)
  const invested = Money.fromKopiyky(Math.round(investedTotalRaw))
  const currentValue = Money.fromKopiyky(Math.round(currentTotalRaw))
  const pnl = currentValue.subtract(invested)
  const pnlPercent = invested.isZero() ? 0 : (pnl.toKopiyky() / invested.toKopiyky()) * 100

  // Найдорожчі активи згори — так само, як зведена таблиця "Огляд"
  // (portfolio-summary.ts) сортує типи активів за currentValue.
  const sortedInvestments = [...investments].sort((a, b) => currentRaw(b) - currentRaw(a))

  // На крипті — дрібні залишки (< CRYPTO_DUST_THRESHOLD_USD) згортаємо під
  // "Показати ще N", щоб список не захаращувався комісіями/пилом. Підсумок
  // зверху (invested/currentValue/pnl) рахується по ВСІХ монетах вище,
  // незалежно від цього фільтра показу.
  // dustCount рахуємо НЕЗАЛЕЖНО від showDust (не як різницю з visibleInvestments —
  // коли показ розгорнутий, visibleInvestments = усі монети і різниця вийде 0,
  // кнопка "Згорнути" зникне й розгорнутий список неможливо було б згорнути назад).
  const isDust = (i: (typeof investments)[number]) => currentRaw(i) / 100 < CRYPTO_DUST_THRESHOLD_USD
  const dustCount = activeType === 'crypto' ? sortedInvestments.filter(isDust).length : 0
  const visibleInvestments =
    activeType === 'crypto' && !showDust ? sortedInvestments.filter((i) => !isDust(i)) : sortedInvestments

  // Гривневий еквівалент (курс НБУ) — показуємо поруч з $ на вкладці
  // "Крипта" (там усе в USD за задумом), решта вкладок валютно неоднорідні
  // (акції можуть бути в UAH/USD/EUR довільно) — там лишаємо як було.
  const uahEquivalent =
    activeType === 'crypto' && rates
      ? {
          invested: Money.fromKopiyky(convertToUahMinorUnits(invested.toKopiyky(), 'USD', rates)),
          currentValue: Money.fromKopiyky(convertToUahMinorUnits(currentValue.toKopiyky(), 'USD', rates)),
          pnl: Money.fromKopiyky(convertToUahMinorUnits(pnl.toKopiyky(), 'USD', rates)),
        }
      : undefined

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
        {/* Одна кнопка синку на вкладці "Крипта" — сама сумісно тягне і
            баланси з Binance, і звичайний push/pull (SyncStatusIndicator
            тут навмисно не рендериться, щоб не було двох кнопок поруч). */}
        {activeType === 'crypto' ? <CryptoSyncButton /> : <SyncStatusIndicator />}
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
              uahEquivalent={uahEquivalent}
              currencySymbol={activeType === 'crypto' ? '$' : '₴'}
              onEditInvested={activeType === 'crypto' ? () => setShowEditInvested(true) : undefined}
            />
          )
        )}

        <div className="px-4 flex flex-col gap-2">
          {/* Крипта тягнеться лише з Binance (ручне додавання прибрано) —
              без підключеного ключа список завжди порожній, тож замість
              загального "Ще немає активу" показуємо, що саме зробити і де
              (посилання веде в Налаштування і саме там відкриває модалку
              ключів — не лишає користувача самого шукати). */}
          {activeType === 'crypto' && binanceStatus && !binanceStatus.connected && (
            <button
              type="button"
              onClick={() => navigate('/settings?openCryptoKeys=1')}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl w-full text-left transition-opacity active:opacity-70"
              style={{ backgroundColor: 'var(--color-bg-card)' }}
            >
              <KeyRound size={20} color="var(--color-accent)" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Підключи Binance, щоб побачити баланси
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                  Введи API-ключ у Налаштуваннях → API-ключі бірж
                </p>
              </div>
              <ChevronRight size={16} color="var(--color-text-secondary)" />
            </button>
          )}

          {!isLoading && investments.length === 0 && !(activeType === 'crypto' && !binanceStatus?.connected) && (
            <div
              className="flex flex-col items-center justify-center min-h-[50vh] gap-4"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <TrendingUp size={48} />
              <p className="text-center text-sm max-w-xs">{emptyText}</p>
            </div>
          )}

          {visibleInvestments.map((inv) => {
            if (activeType === 'deposit') return <DepositListItem key={inv.id} investment={inv} />
            if (activeType === 'bond') return <BondListItem key={inv.id} investment={inv} />
            if (activeType === 'crypto') {
              return <CryptoListItem key={inv.id} investment={inv} />
            }
            return (
              <InvestmentListItem
                key={inv.id}
                investment={inv}
                onPress={() => navigate(`/investments/${inv.id}`)}
              />
            )
          })}

          {activeType === 'crypto' && dustCount > 0 && (
            <button
              type="button"
              onClick={() => setShowDust((v) => !v)}
              className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {showDust ? (
                <>Згорнути <ChevronUp size={14} /></>
              ) : (
                <>Показати ще {dustCount} монет (&lt;${CRYPTO_DUST_THRESHOLD_USD}) <ChevronDown size={14} /></>
              )}
            </button>
          )}
        </div>
      </div>

      {showEditInvested && (
        <EditCryptoInvestedModal
          currentInvested={invested}
          onClose={() => setShowEditInvested(false)}
          onSave={(newTotalUnits) => scaleCryptoInvested.mutateAsync(newTotalUnits)}
        />
      )}
    </div>
  )
}
