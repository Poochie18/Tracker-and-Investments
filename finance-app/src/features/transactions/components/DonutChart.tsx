import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

interface DonutSegment {
  name: string
  value: number
  color: string
}

interface DonutChartProps {
  data: DonutSegment[]
  centerLabel: string
  centerSublabel?: string
}

export function DonutChart({ data, centerLabel, centerSublabel }: DonutChartProps) {
  const hasData = data.length > 0 && data.some((d) => d.value > 0)

  // Порожній стан — сіре кільце з текстом
  const chartData = hasData ? data : [{ name: 'empty', value: 1, color: 'rgba(255,255,255,0.06)' }]

  return (
    <div className="relative flex items-center justify-center" style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={72}
            outerRadius={100}
            paddingAngle={hasData ? 3 : 0}
            dataKey="value"
            stroke="none"
            startAngle={90}
            endAngle={-270}
            isAnimationActive={false}
          >
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Центр пончика — сума або "Немає даних" */}
      <div
        className="absolute flex flex-col items-center justify-center pointer-events-none"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
      >
        <span
          className="text-xl font-bold leading-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {hasData ? centerLabel : '0 ₴'}
        </span>
        {centerSublabel && (
          <span className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {centerSublabel}
          </span>
        )}
        {!hasData && (
          <span className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            Немає даних
          </span>
        )}
      </div>
    </div>
  )
}
