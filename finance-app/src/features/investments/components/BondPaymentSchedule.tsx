import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { CheckCircle2, Circle } from 'lucide-react'
import { Money } from '@/lib/utils/money'
import { getBondPaymentSchedule } from '../bond-schedule'
import type { LocalBondCouponDate, LocalBondLot } from '@/lib/db/schema'

interface BondPaymentScheduleProps {
  dates: LocalBondCouponDate[]
  redemptionDate: string | null // ISO 8601 — дата погашення (окреме поле, не з dates)
  lots: LocalBondLot[]           // партії купівлі — визначають кількість "на руках" на кожну дату
  couponAmountPerUnit: number | null // копійки, за 1 шт
  redemptionAmountPerUnit: number    // копійки, за 1 шт — номінал, що повертається при погашенні
  currency: string
}

const CURRENCY_SYMBOLS: Record<string, string> = { UAH: '₴', USD: '$', EUR: '€' }

// Графік виплат облігації: дати купонів + окрема дата погашення (якщо
// збігаються — один рядок з обома позначками). Минулі дати показуються
// неактивними (виплата вже відбулась), майбутні — активними. Сума купона
// на кожну дату рахується по кількості лотів, куплених ДО цієї дати —
// докупівля не змінює суму вже минулих виплат.
export function BondPaymentSchedule({ dates, redemptionDate, lots, couponAmountPerUnit, redemptionAmountPerUnit, currency }: BondPaymentScheduleProps) {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency
  const fmt = (kopiyky: number) => Money.fromKopiyky(kopiyky).formatCompact(symbol)
  const rows = getBondPaymentSchedule(dates, redemptionDate, lots, couponAmountPerUnit, redemptionAmountPerUnit)

  if (rows.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        Дати виплат ще не додані.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {rows.map((row) => {
        const amount = row.amount
        const label = row.isCoupon && row.isRedemption ? 'Купон + Погашення' : row.isRedemption ? 'Погашення' : 'Купон'
        return (
          <div
            key={row.date}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
            style={{
              backgroundColor: 'rgba(0,0,0,0.15)',
              opacity: row.isPast ? 0.5 : 1,
            }}
          >
            {row.isPast ? (
              <CheckCircle2 size={16} style={{ color: 'var(--color-text-secondary)' }} />
            ) : (
              <Circle size={16} style={{ color: row.isRedemption ? 'var(--color-accent)' : 'var(--color-income)' }} />
            )}

            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {format(new Date(row.date), 'd MMMM yyyy', { locale: uk })}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                {label}
              </p>
            </div>

            {amount > 0 && (
              <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {fmt(amount)}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
