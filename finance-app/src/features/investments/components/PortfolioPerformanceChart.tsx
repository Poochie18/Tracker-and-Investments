import {
  ComposedChart, Bar, Line, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { convertFromUahMinorUnits, type ExchangeRates } from '@/lib/investments/exchange-rate'
import type { PortfolioSummary } from '../portfolio-summary'
import type { DisplayCurrency } from './CurrencySwitch'

interface PortfolioPerformanceChartProps {
  summary: PortfolioSummary
  displayCurrency: DisplayCurrency
  rates: ExchangeRates
}

interface TooltipPayloadItem {
  dataKey: string
  value: number
  payload: { label: string; currentValueDisplay: number; pnlPercent: number }
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload?.length) return null
  const { label, currentValueDisplay, pnlPercent } = payload[0].payload
  return (
    <div
      className="px-3 py-2 rounded-xl text-xs"
      style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      <p className="font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
      <p style={{ color: 'var(--color-text-secondary)' }}>
        Вартість: {Math.round(currentValueDisplay).toLocaleString('uk-UA')}
      </p>
      <p style={{ color: pnlPercent >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}>
        Дохідність: {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%
      </p>
    </div>
  )
}

// Комбінований графік: стовпці — поточна вартість кожного типу вкладення,
// лінія — його дохідність у %. Дві осі Y, бо шкали геть різні (гроші vs проценти).
export function PortfolioPerformanceChart({ summary, displayCurrency, rates }: PortfolioPerformanceChartProps) {
  const symbol = displayCurrency === 'UAH' ? '₴' : '$'

  const data = summary.rows.map((r) => ({
    label: r.label,
    currentValueDisplay: convertFromUahMinorUnits(r.currentValue, displayCurrency, rates) / 100,
    pnlPercent: r.pnlPercent,
    colorHex: r.colorHex,
  }))

  return (
    <div>
      <p className="text-xs font-medium px-4 mb-1" style={{ color: 'var(--color-text-secondary)' }}>
        Поточна вартість і дохідність по типах
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="value"
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v: number) => `${symbol}${(v / 1000).toFixed(0)}k`}
          />
          <YAxis
            yAxisId="percent"
            orientation="right"
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={36}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar yAxisId="value" dataKey="currentValueDisplay" radius={[6, 6, 0, 0]} maxBarSize={48}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.colorHex} />
            ))}
          </Bar>
          <Line
            yAxisId="percent"
            type="monotone"
            dataKey="pnlPercent"
            stroke="#4A90E2"
            strokeWidth={2}
            dot={{ r: 4, fill: '#4A90E2' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
