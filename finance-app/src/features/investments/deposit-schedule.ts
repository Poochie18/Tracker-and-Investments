import type { LocalDepositContribution, LocalInvestment } from '@/lib/db/schema'

// ============================================================
// Помісячний графік нарахувань депозиту — та сама формула,
// що в листі "Депозити" Excel-трекера користувача:
//
//   місячна ставка = річна ставка% / 100 / 12
//   місяць 0:  початок = сума вкладу, поповнення = 0, нараховано = 0, кінець = початок
//   місяць N:  початок = кінець(N-1)
//              поповнення = введене вручну (0 якщо не введено)
//              нараховано = (початок + поповнення) × місячна ставка
//              кінець = початок + поповнення + нараховано
//
// Нарахування й залишок НІКОЛИ не зберігаються — рахуються щоразу
// наново з initial amount + rate + список поповнень, тому не можуть
// розсинхронитись з реальними даними.
// ============================================================

export interface DepositScheduleRow {
  monthIndex: number
  startBalance: number   // копійки
  contribution: number   // копійки, введене користувачем (0 якщо немає)
  accrued: number        // копійки, нараховані відсотки за місяць
  endBalance: number     // копійки
}

export function computeDepositSchedule(
  investment: LocalInvestment,
  contributions: LocalDepositContribution[]
): DepositScheduleRow[] {
  const termMonths = investment.term_months ?? 0
  const annualRate = investment.interest_rate_percent ?? 0
  const monthlyRate = annualRate / 100 / 12
  const initialAmount = Math.round(investment.purchase_price * investment.quantity)

  const contributionByMonth = new Map(contributions.map((c) => [c.month_index, c.amount]))

  const rows: DepositScheduleRow[] = [
    { monthIndex: 0, startBalance: initialAmount, contribution: 0, accrued: 0, endBalance: initialAmount },
  ]

  for (let month = 1; month <= termMonths; month++) {
    const prev = rows[month - 1]
    const contribution = contributionByMonth.get(month) ?? 0
    const accrued = Math.round((prev.endBalance + contribution) * monthlyRate)
    const endBalance = prev.endBalance + contribution + accrued

    rows.push({ monthIndex: month, startBalance: prev.endBalance, contribution, accrued, endBalance })
  }

  return rows
}
