// Форматування рядків, що не стосуються грошей або дат.

// Скорочення довгого тексту
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}…`
}

// Форматування відсотків: "45.3%" або "45%"
export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`
}

// Перша буква великою
export function capitalize(text: string): string {
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}
