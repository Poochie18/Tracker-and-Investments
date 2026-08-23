import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { TrendingUp } from 'lucide-react'
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator'
import { AccountIconButton } from '@/components/AccountIconButton'
import { useAuth } from '@/hooks/use-auth'
import { useAllDepositContributions } from '@/hooks/use-deposit-contributions'
import { useAllBondCouponDates } from '@/hooks/use-bond-coupon-dates'
import { usePortfolioSnapshots } from '@/hooks/use-portfolio-snapshots'
import { useFiscalYearStartMonth } from '@/lib/settings/fiscal-year'
import { computePortfolioSummary, buildPortfolioSummaryFromAmounts, type PortfolioSummary } from '../portfolio-summary'
import { useAutoPortfolioSnapshot } from '../use-auto-portfolio-snapshot'
import { CurrencySwitch, type DisplayCurrency } from './CurrencySwitch'
import { PortfolioSummaryTable } from './PortfolioSummaryTable'
import { PortfolioAllocationChart } from './PortfolioAllocationChart'
import { PortfolioPerformanceChart } from './PortfolioPerformanceChart'
import type { ExchangeRates } from '@/lib/investments/exchange-rate'
import type { LocalInvestment } from '@/lib/db/schema'

interface PortfolioOverviewProps {
  investments: LocalInvestment[]
  rates: ExchangeRates | undefined
  isLoading: boolean
}

interface PortfolioView {
  key: string          // 'live' або fiscal_year_key зліпку
  label: string        // "Поточний" або "2025–2026"
  summary: PortfolioSummary
  rates: ExchangeRates
}

// Сторінка "Огляд" розділу Інвестиції — зведена таблиця по типах вкладення
// (аналог листа "Сводка" з Excel-трекера користувача) + два графіки:
// розподіл портфеля (pie) і поточна вартість відносно дохідності (bar+line).
// Суми перераховуються між UAH/USD за курсом НБУ через перемикач валюти.
//
// Кнопки по роках дозволяють переглянути "зліпок" портфеля на кінець
// минулих фінансових років (history.portfolio_snapshots) поруч із живими
// даними — кожен рік показується у власному курсі валют на момент зліпку.
export function PortfolioOverview({ investments, rates, isLoading }: PortfolioOverviewProps) {
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('UAH')
  const [selectedViewKey, setSelectedViewKey] = useState('live')
  const { user } = useAuth()
  const { data: depositContributions = [] } = useAllDepositContributions(user?.id)
  const { data: bondCouponDates = [] } = useAllBondCouponDates(user?.id)
  const { data: snapshots = [] } = usePortfolioSnapshots(user?.id)
  const fiscalYearStartMonth = useFiscalYearStartMonth()

  const liveSummary = useMemo(
    () =>
      rates
        ? computePortfolioSummary(investments, rates, depositContributions, bondCouponDates, fiscalYearStartMonth)
        : null,
    [investments, rates, depositContributions, bondCouponDates, fiscalYearStartMonth]
  )

  // Найкращий момент зафіксувати зліпок минулого року — коли є свіжі живі
  // дані під рукою (див. use-auto-portfolio-snapshot.ts).
  useAutoPortfolioSnapshot(user?.id, liveSummary, rates, fiscalYearStartMonth)

  const views = useMemo<PortfolioView[]>(() => {
    const result: PortfolioView[] = []
    if (liveSummary && rates) {
      result.push({ key: 'live', label: 'Поточний', summary: liveSummary, rates })
    }
    const sorted = [...snapshots].sort((a, b) => b.fiscal_year_key.localeCompare(a.fiscal_year_key))
    for (const s of sorted) {
      result.push({
        key: s.fiscal_year_key,
        label: s.fiscal_year_label,
        summary: buildPortfolioSummaryFromAmounts(s.rows),
        rates: { usd: s.rates_usd, eur: s.rates_eur, date: format(new Date(s.snapshot_date), 'd.MM.yyyy') },
      })
    }
    return result
  }, [liveSummary, rates, snapshots])

  const selectedView = views.find((v) => v.key === selectedViewKey) ?? views[0]

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
        <AccountIconButton />
        <h1 className="text-xl font-semibold flex-1" style={{ color: 'var(--color-text-primary)' }}>
          Інвестиції
        </h1>
        <SyncStatusIndicator />
      </div>

      <div className="flex flex-col gap-5 py-4 pb-24">
        {!isLoading && investments.length === 0 && (
          <div
            className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <TrendingUp size={48} />
            <p className="text-center text-sm max-w-xs">
              Ще немає жодного активу. Додай перший через кнопку "+" знизу — акцію, крипту, депозит чи облігацію.
            </p>
          </div>
        )}

        {investments.length > 0 && !liveSummary && (
          <p className="text-center text-sm py-8" style={{ color: 'var(--color-text-secondary)' }}>
            Завантажуємо курс НБУ...
          </p>
        )}

        {investments.length > 0 && selectedView && (
          <>
            {/* ── Кнопки по роках (Поточний + минулі фінансові роки) ── */}
            {views.length > 1 && (
              <div className="flex gap-2 px-4 overflow-x-auto">
                {views.map((v) => {
                  const isActive = v.key === selectedViewKey
                  return (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => setSelectedViewKey(v.key)}
                      className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: isActive ? 'var(--color-accent)' : 'var(--color-bg-card)',
                        color: isActive ? '#1B2A2A' : 'var(--color-text-secondary)',
                      }}
                    >
                      {v.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* ── Перемикач валюти + дата курсу ─────────────── */}
            <div className="flex items-center justify-between px-4">
              <CurrencySwitch active={displayCurrency} onChange={setDisplayCurrency} />
              {selectedView.rates.date && (
                <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                  {selectedView.key === 'live' ? 'Курс НБУ на ' : 'Курс на дату зліпку — '}
                  {selectedView.rates.date}
                </p>
              )}
            </div>

            {/* ── Зведена таблиця по типах ───────────────────── */}
            <PortfolioSummaryTable summary={selectedView.summary} displayCurrency={displayCurrency} rates={selectedView.rates} />

            {/* ── Графіки ─────────────────────────────────────── */}
            <PortfolioAllocationChart summary={selectedView.summary} displayCurrency={displayCurrency} rates={selectedView.rates} />
            <PortfolioPerformanceChart summary={selectedView.summary} displayCurrency={displayCurrency} rates={selectedView.rates} />
          </>
        )}
      </div>
    </div>
  )
}
