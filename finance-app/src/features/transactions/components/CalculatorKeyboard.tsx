// CalculatorKeyboard — цифрова клавіатура з математичними операціями.
// Клавіші: 7-8-9-÷ / 4-5-6-× / 1-2-3-- / .-0-⌫-+ і = для обчислення.
// Безпечне обчислення: вираз перевіряється регексом перед eval.

interface CalculatorKeyboardProps {
  value: string
  onChange: (value: string) => void
}

const ROWS = [
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '-'],
  ['.', '0', '⌫', '+'],
]

const OPERATORS = ['+', '-', '×', '÷']
const MAX_LEN = 20

function safeCalculate(expr: string): string {
  // Замінюємо символи × і ÷ на * і / перед eval
  const sanitized = expr.replace(/×/g, '*').replace(/÷/g, '/')
  // Тільки цифри, крапки і оператори
  if (!/^[\d.+\-*/]+$/.test(sanitized)) return expr
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${sanitized})`)() as unknown
    if (typeof result !== 'number' || !isFinite(result)) return expr
    // Округлюємо до 2 знаків після коми, прибираємо зайві нулі
    return String(Math.round(result * 100) / 100)
  } catch {
    return expr
  }
}

export function CalculatorKeyboard({ value, onChange }: CalculatorKeyboardProps) {
  const lastChar = value.slice(-1)
  const isLastOperator = OPERATORS.includes(lastChar)

  const handleKey = (key: string) => {
    if (key === '⌫') {
      onChange(value.slice(0, -1))
      return
    }

    if (key === '=') {
      if (value) onChange(safeCalculate(value))
      return
    }

    if (value.length >= MAX_LEN) return

    if (OPERATORS.includes(key)) {
      // Не починаємо з оператора (крім мінуса)
      if (!value && key !== '-') return
      // Замінюємо попередній оператор
      if (isLastOperator) {
        onChange(value.slice(0, -1) + key)
        return
      }
      onChange(value + key)
      return
    }

    if (key === '.') {
      // Знаходимо поточний числовий сегмент (після останнього оператора)
      const segments = value.split(/[+\-×÷]/)
      const lastSegment = segments[segments.length - 1]
      if (lastSegment.includes('.')) return
      if (!value || isLastOperator) {
        onChange(value + '0.')
        return
      }
      onChange(value + '.')
      return
    }

    // Цифра
    // Запобігаємо "00" на початку сегмента
    const segments = value.split(/[+\-×÷]/)
    const lastSegment = segments[segments.length - 1]
    if (lastSegment === '0' && key !== '.') {
      // Замінюємо лідируючий 0
      onChange(value.slice(0, -1) + key)
      return
    }

    onChange(value + key)
  }

  return (
    <div className="flex flex-col gap-1 px-2">
      {ROWS.map((row, ri) => (
        <div key={ri} className="flex gap-1">
          {row.map((key) => {
            const isOp = OPERATORS.includes(key)
            const isBackspace = key === '⌫'
            return (
              <button
                key={key}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault()
                  handleKey(key)
                }}
                className="flex-1 flex items-center justify-center h-13 rounded-xl text-lg font-medium select-none active:opacity-60 transition-opacity"
                style={{
                  height: 52,
                  backgroundColor: isBackspace
                    ? 'rgba(255,107,107,0.12)'
                    : isOp
                      ? 'rgba(0,200,150,0.15)'
                      : 'var(--color-bg-card)',
                  color: isBackspace
                    ? 'var(--color-expense)'
                    : isOp
                      ? 'var(--color-accent)'
                      : 'var(--color-text-primary)',
                }}
              >
                {key}
              </button>
            )
          })}
        </div>
      ))}

      {/* Кнопка = */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault()
          handleKey('=')
        }}
        className="flex items-center justify-center rounded-xl font-semibold text-lg select-none active:opacity-60 transition-opacity"
        style={{
          height: 52,
          backgroundColor: 'var(--color-accent)',
          color: '#1B2A2A',
        }}
      >
        =
      </button>
    </div>
  )
}
