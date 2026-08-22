import { useMemo, useState } from 'react'
import { PlusCircle, TrendingUp } from 'lucide-react'
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator'
import { AccountIconButton } from '@/components/AccountIconButton'
import { computePortfolioSummary } from '../portfolio-summary'
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
  onAddClick: () => void
}

// Сторінка "Огляд" розділу Інвестиції — зведена таблиця по типах вкладення
// (аналог листа "Сводка" з Excel-трекера користувача) + два графіки:
// розподіл портфеля (pie) і поточна вартість відносно дохідності (bar+line).
// Суми перераховуються між UAH/USD за курсом НБУ через перемикач валюти.
export function PortfolioOverview({ investments, rates, isLoading, onAddClick }: PortfolioOverviewProps) {
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('UAH')

  const summary = useMemo(
    () => (rates ? computePortfolioSummary(investments, rates) : null),
    [investments, rates]
  )

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
              Ще немає жодного активу. Додай перший — акцію, крипту, депозит чи облігацію.
            </p>
            <button
              onClick={onAddClick}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm"
              style={{ backgroundColor: 'var(--color-accent)', color: '#1B2A2A' }}
            >
              <PlusCircle size={18} />
              Додати актив
            </button>
          </div>
        )}

        {investments.length > 0 && !summary && (
          <p className="text-center text-sm py-8" style={{ color: 'var(--color-text-secondary)' }}>
            Завантажуємо курс НБУ...
          </p>
        )}

        {investments.length > 0 && summary && rates && (
          <>
            {/* ── Перемикач валюти + дата курсу ─────────────── */}
            <div className="flex items-center justify-between px-4">
              <CurrencySwitch active={displayCurrency} onChange={setDisplayCurrency} />
              {rates.date && (
                <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                  Курс НБУ на {rates.date}
                </p>
              )}
            </div>

            {/* ── Зведена таблиця по типах ───────────────────── */}
            <PortfolioSummaryTable summary={summary} displayCurrency={displayCurrency} rates={rates} />

            {/* ── Графіки ─────────────────────────────────────── */}
            <PortfolioAllocationChart summary={summary} displayCurrency={displayCurrency} rates={rates} />
            <PortfolioPerformanceChart summary={summary} displayCurrency={displayCurrency} rates={rates} />

            <div className="px-4">
              <button
                onClick={onAddClick}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-medium text-sm"
                style={{ backgroundColor: 'var(--color-bg-card)', color: 'var(--color-accent)' }}
              >
                <PlusCircle size={18} />
                Додати актив
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
