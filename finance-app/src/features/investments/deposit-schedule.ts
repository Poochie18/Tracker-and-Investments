import type { LocalDepositContribution, LocalInvestment } from '@/lib/db/schema'

// ============================================================
// Помісячний графік нарахувань депозиту — та сама формула,
// що в листі "Депозити" Excel-трекера користувача:
//
//   фактична ставка = річна ставка (банку) × (1 − податок 23%)
//   місячна ставка = фактична ставка% / 100 / 12
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

// Податок на дохід за депозитом в Україні: 18% ПДФО + 5% військовий збір
export const DEPOSIT_TAX_RATE = 0.23

// Фактична (посподаткова) ставка — саме вона використовується для нарахувань
export function getEffectiveRatePercent(bankRatePercent: number): number {
  return bankRatePercent * (1 - DEPOSIT_TAX_RATE)
}

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
  const bankRate = investment.interest_rate_percent ?? 0
  const effectiveRate = getEffectiveRatePercent(bankRate)
  const monthlyRate = effectiveRate / 100 / 12
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

export interface DepositTotals {
  invested: number     // копійки: початковий вклад + усі поповнення за весь строк
  currentValue: number // копійки: залишок на кінець останнього місяця строку (повна сума до отримання)
  profit: number       // копійки: сума всіх місячних нарахувань за весь строк (= currentValue - invested)
}

// Підсумки по депозиту рахуються на весь строк наперед (ставка й поповнення
// фіксовані договором), а не на "сьогодні" — тому "поточна вартість" депозиту
// в портфелі це вартість на кінець останнього місяця строку, а не станом
// на прожиту частину строку.
export function computeDepositTotals(
  investment: LocalInvestment,
  contributions: LocalDepositContribution[]
): DepositTotals {
  const schedule = computeDepositSchedule(investment, contributions)
  const lastRow = schedule[schedule.length - 1]

  const contributed = schedule.reduce((sum, row) => sum + row.contribution, 0)
  const invested = schedule[0].startBalance + contributed
  const profit = schedule.reduce((sum, row) => sum + row.accrued, 0)

  return { invested, currentValue: lastRow.endBalance, profit }
}
