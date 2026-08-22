import { addMonths, format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { Pencil } from 'lucide-react'
import { Money } from '@/lib/utils/money'
import type { DepositScheduleRow } from '../deposit-schedule'

interface DepositScheduleTableProps {
  rows: DepositScheduleRow[]
  purchaseDate: string
  currency: string
  onEditMonth: (monthIndex: number, monthLabel: string) => void
}

const CURRENCY_SYMBOLS: Record<string, string> = { UAH: '₴', USD: '$', EUR: '€' }

// Помісячний графік нарахувань депозиту — Місяць | Початок | Поповнення |
// Нараховано | Кінець. Клік по рядку — редагувати поповнення за цей місяць
// (той самий референс-макет, що в листі "Депозити" оригінального Excel).
export function DepositScheduleTable({ rows, purchaseDate, currency, onEditMonth }: DepositScheduleTableProps) {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency
  const fmt = (kopiyky: number) => Money.fromKopiyky(kopiyky).formatCompact(symbol)
  const monthLabel = (monthIndex: number) =>
    format(addMonths(new Date(purchaseDate), monthIndex), 'LLLL yyyy', { locale: uk })

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 480 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th className="px-2.5 py-2 text-left font-medium whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                Місяць
              </th>
              <th className="px-2.5 py-2 text-right font-medium whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                Початок
              </th>
              <th className="px-2.5 py-2 text-right font-medium whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                Поповнення
              </th>
              <th className="px-2.5 py-2 text-right font-medium whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                Нараховано
              </th>
              <th className="px-2.5 py-2 text-right font-medium whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                Кінець
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const label = monthLabel(row.monthIndex)
              return (
                <tr key={row.monthIndex} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
                    {row.monthIndex}. {label}
                  </td>
                  <td className="px-2.5 py-2 text-right whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                    {fmt(row.startBalance)}
                  </td>
                  <td className="px-0 py-1 text-right whitespace-nowrap">
                    {row.monthIndex === 0 ? (
                      <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
                    ) : (
                      <button
                        onClick={() => onEditMonth(row.monthIndex, label)}
                        className="flex items-center gap-1 justify-end w-full px-2.5 py-1 rounded-lg active:opacity-60"
                        style={{ color: row.contribution > 0 ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}
                      >
                        {row.contribution > 0 ? fmt(row.contribution) : 'Додати'}
                        <Pencil size={11} />
                      </button>
                    )}
                  </td>
                  <td className="px-2.5 py-2 text-right whitespace-nowrap" style={{ color: 'var(--color-income)' }}>
                    +{fmt(row.accrued)}
                  </td>
                  <td className="px-2.5 py-2 text-right font-medium whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>
                    {fmt(row.endBalance)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
