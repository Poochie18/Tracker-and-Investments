import { useMemo, useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useTransactions } from '@/hooks/use-transactions'
import { Money } from '@/lib/utils/money'

const MONTH_LABELS = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру']

const SERIES_LABELS: Record<string, string> = {
  income: 'Дохід',
  expense: 'Витрати',
  profit: 'Прибуток/збиток',
}

// Кольори повторюють CSS-токени --color-income/--color-expense/--color-accent
// (src/index.css) — не var() напряму в fill/stroke: те саме рішення вже в
// PortfolioPerformanceChart.tsx (Recharts рендерить їх як SVG-атрибути, а
// не inline style, де var() надійно резолвиться).
const COLOR_INCOME = '#51cf66'
const COLOR_EXPENSE = '#ff6b6b'
const COLOR_PROFIT = '#00c896'

interface MonthDatum {
  month: string
  income: number   // копійки
  expense: number  // копійки
  profit: number   // копійки, income - expense
}

interface TooltipPayloadItem {
  dataKey: string
  value: number
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) {
  if (!active || !payload?.length) return null
  const byKey = new Map(payload.map((p) => [p.dataKey, p.value]))
  const income = byKey.get('income') ?? 0
  const expense = byKey.get('expense') ?? 0
  const profit = byKey.get('profit') ?? 0

  return (
    <div
      className="px-3 py-2 rounded-xl text-xs"
      style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      <p className="font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
      <p style={{ color: COLOR_INCOME }}>Дохід: {Money.fromKopiyky(income).formatCompact()}</p>
      <p style={{ color: COLOR_EXPENSE }}>Витрати: {Money.fromKopiyky(expense).formatCompact()}</p>
      <p style={{ color: profit >= 0 ? COLOR_INCOME : COLOR_EXPENSE }}>
        {profit >= 0 ? 'Прибуток' : 'Збиток'}: {Money.fromKopiyky(Math.abs(profit)).formatCompact()}
      </p>
    </div>
  )
}

// Дохід, витрати і прибуток/збиток по місяцях за обраний (календарний) рік —
// стовпці дохід/витрати згруповані по місяцю + лінія прибутку. Одна вісь Y
// (усі три серії — гроші в тій самій валюті/базисі), на відміну від
// PortfolioPerformanceChart, де сума й % мають різні шкали.
export function MonthlyIncomeExpenseChart() {
  const { user } = useAuth()
  const [year, setYear] = useState(() => new Date().getFullYear())
  const currentYear = new Date().getFullYear()

  const dateFrom = useMemo(() => new Date(year, 0, 1), [year])
  const dateTo = useMemo(() => new Date(year, 11, 31, 23, 59, 59, 999), [year])

  const { data: transactions = [] } = useTransactions({
    userId: user?.id ?? '',
    dateFrom,
    dateTo,
  })

  const data = useMemo<MonthDatum[]>(() => {
    const byMonth = MONTH_LABELS.map((month) => ({ month, income: 0, expense: 0 }))
    for (const t of transactions) {
      const monthIndex = new Date(t.date).getMonth()
      if (t.type === 'income') byMonth[monthIndex].income += t.amount
      else byMonth[monthIndex].expense += t.amount
    }
    return byMonth.map((m) => ({ ...m, profit: m.income - m.expense }))
  }, [transactions])

  return (
    <div>
      {/* ── Навігація по роках ─────────────────────────────── */}
      <div className="flex items-center justify-center gap-3 mb-2">
        <button
          type="button"
          onClick={() => setYear((y) => y - 1)}
          className="p-1 rounded-full active:opacity-60"
          aria-label="Попередній рік"
        >
          <ChevronLeft size={18} color="rgba(255,255,255,0.6)" />
        </button>
        <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>{year}</p>
        <button
          type="button"
          onClick={() => setYear((y) => y + 1)}
          disabled={year >= currentYear}
          className="p-1 rounded-full active:opacity-60 disabled:opacity-30"
          aria-label="Наступний рік"
        >
          <ChevronRight size={18} color="rgba(255,255,255,0.6)" />
        </button>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v: number) => `${Math.round(v / 100000)}k`}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Legend
            formatter={(value: string) => SERIES_LABELS[value] ?? value}
            wrapperStyle={{ fontSize: 11 }}
          />
          <Bar dataKey="income" name="income" fill={COLOR_INCOME} radius={[4, 4, 0, 0]} maxBarSize={14} />
          <Bar dataKey="expense" name="expense" fill={COLOR_EXPENSE} radius={[4, 4, 0, 0]} maxBarSize={14} />
          <Line
            dataKey="profit"
            name="profit"
            type="monotone"
            stroke={COLOR_PROFIT}
            strokeWidth={2}
            dot={{ r: 3, fill: COLOR_PROFIT }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
