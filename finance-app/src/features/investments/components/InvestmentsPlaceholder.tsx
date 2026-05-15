import { TrendingUp } from 'lucide-react'

// Інвестиції — Фаза 7, зараз тільки заглушка
export function InvestmentsPlaceholder() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6"
      style={{ color: 'var(--color-text-secondary)' }}
    >
      <TrendingUp size={48} />
      <p className="text-center text-sm">
        Модуль інвестицій буде доступний у наступних версіях
      </p>
    </div>
  )
}
