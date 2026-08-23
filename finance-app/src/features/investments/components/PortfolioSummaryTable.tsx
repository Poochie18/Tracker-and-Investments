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
  // formatWhole — без копійок: у щільній таблиці зведення точність до копійки
  // тільки займає місце й заважає читати.
  const fmt = (uahMinorUnits: number) =>
    Money.fromKopiyky(convertFromUahMinorUnits(uahMinorUnits, displayCurrency, rates)).formatWhole(symbol)

  // Дохід і дохід % зведені в одну колонку ("+123 ₴ · +12.3%") — окремі
  // колонки на вузькому екрані розтягували таблицю значно ширше за потрібне.
  const pnlCell = (pnl: number, pnlPercent: number) => {
    const isProfit = pnl >= 0
    return (
      <Td color={isProfit ? 'var(--color-income)' : 'var(--color-expense)'}>
        {isProfit ? '+' : ''}{fmt(pnl)}
        <span className="opacity-70"> · {isProfit ? '+' : ''}{formatPercent(pnlPercent, 1)}</span>
      </Td>
    )
  }

  return (
    <div className="mx-4 rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 380 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <Th align="left">Тип</Th>
              <Th>Вкладено</Th>
              <Th>Вартість</Th>
              <Th>Дохід</Th>
              <Th>Частка</Th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((row) => (
              <tr key={row.type} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: row.colorHex }}
                    />
                    <span style={{ color: 'var(--color-text-primary)' }}>{row.label}</span>
                  </div>
                </td>
                <Td>{fmt(row.invested)}</Td>
                <Td>{fmt(row.currentValue)}</Td>
                {pnlCell(row.pnl, row.pnlPercent)}
                <Td>{formatPercent(row.portfolioPercent, 1)}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-2 py-2.5 font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Разом
              </td>
              <Td bold>{fmt(summary.totalInvested)}</Td>
              <Td bold>{fmt(summary.totalCurrentValue)}</Td>
              {pnlCell(summary.totalPnl, summary.totalPnlPercent)}
              <Td bold>100%</Td>
            </tr>
          </tfoot>
        </table>
      </div>
      {summary.rows.some((r) => r.type === 'bond') && (
        <p className="text-[10px] px-3 pb-2 pt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Дохід по облігаціях — за поточний фінансовий рік
        </p>
      )}
    </div>
  )
}

function Th({ children, align = 'right' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className="px-2 py-2 text-[11px] font-medium whitespace-nowrap"
      style={{ color: 'var(--color-text-secondary)', textAlign: align }}
    >
      {children}
    </th>
  )
}

function Td({ children, color, bold }: { children: React.ReactNode; color?: string; bold?: boolean }) {
  return (
    <td
      className={`px-2 py-2.5 text-right whitespace-nowrap ${bold ? 'font-semibold' : ''}`}
      style={{ color: color ?? 'var(--color-text-primary)' }}
    >
      {children}
    </td>
  )
}
