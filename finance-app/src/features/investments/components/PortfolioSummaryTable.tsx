import { Money } from '@/lib/utils/money'
import { formatPercent } from '@/lib/utils/format'
import { convertFromUahMinorUnits, type ExchangeRates } from '@/lib/investments/exchange-rate'
import type { PortfolioSummary } from '../portfolio-summary'
import type { DisplayCurrency } from './CurrencySwitch'

interface PortfolioSummaryTableProps {
  summary: PortfolioSummary
  displayCurrency: DisplayCurrency
  rates: ExchangeRates
}

const SYMBOL: Record<DisplayCurrency, string> = { UAH: '₴', USD: '$' }

// Таблиця по типах вкладення — аналог листа "Сводка" з Excel:
// Тип | Вкладено | Поточна вартість | Дохід | Дохід % | Частка портфеля.
// Горизонтальний скрол на вузьких екранах — колонок забагато для одного екрана.
export function PortfolioSummaryTable({ summary, displayCurrency, rates }: PortfolioSummaryTableProps) {
  const symbol = SYMBOL[displayCurrency]
  const fmt = (uahMinorUnits: number) =>
    Money.fromKopiyky(convertFromUahMinorUnits(uahMinorUnits, displayCurrency, rates)).formatCompact(symbol)

  return (
    <div className="mx-4 rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 560 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <Th align="left">Тип вкладення</Th>
              <Th>Вкладено</Th>
              <Th>Поточна вартість</Th>
              <Th>Дохід</Th>
              <Th>Дохід %</Th>
              <Th>Частка</Th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((row) => {
              const isProfit = row.pnl >= 0
              return (
                <tr key={row.type} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: row.colorHex }}
                      />
                      <span style={{ color: 'var(--color-text-primary)' }}>{row.label}</span>
                    </div>
                  </td>
                  <Td>{fmt(row.invested)}</Td>
                  <Td>{fmt(row.currentValue)}</Td>
                  <Td color={isProfit ? 'var(--color-income)' : 'var(--color-expense)'}>
                    {isProfit ? '+' : ''}
                    {fmt(row.pnl)}
                  </Td>
                  <Td color={isProfit ? 'var(--color-income)' : 'var(--color-expense)'}>
                    {isProfit ? '+' : ''}
                    {formatPercent(row.pnlPercent, 1)}
                  </Td>
                  <Td>{formatPercent(row.portfolioPercent, 1)}</Td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-3 py-3 font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Разом
              </td>
              <Td bold>{fmt(summary.totalInvested)}</Td>
              <Td bold>{fmt(summary.totalCurrentValue)}</Td>
              <Td bold color={summary.totalPnl >= 0 ? 'var(--color-income)' : 'var(--color-expense)'}>
                {summary.totalPnl >= 0 ? '+' : ''}
                {fmt(summary.totalPnl)}
              </Td>
              <Td bold color={summary.totalPnl >= 0 ? 'var(--color-income)' : 'var(--color-expense)'}>
                {summary.totalPnl >= 0 ? '+' : ''}
                {formatPercent(summary.totalPnlPercent, 1)}
              </Td>
              <Td bold>100%</Td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function Th({ children, align = 'right' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className="px-3 py-2.5 text-xs font-medium whitespace-nowrap"
      style={{ color: 'var(--color-text-secondary)', textAlign: align }}
    >
      {children}
    </th>
  )
}

function Td({ children, color, bold }: { children: React.ReactNode; color?: string; bold?: boolean }) {
  return (
    <td
      className={`px-3 py-3 text-right whitespace-nowrap ${bold ? 'font-semibold' : ''}`}
      style={{ color: color ?? 'var(--color-text-primary)' }}
    >
      {children}
    </td>
  )
}
