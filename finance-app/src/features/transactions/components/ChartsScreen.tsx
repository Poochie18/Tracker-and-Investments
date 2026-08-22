import { LineChart } from 'lucide-react'
import { ComingSoonScreen } from '@/components/ComingSoonScreen'

// Розширені графіки (тренди по місяцях, порівняння категорій у часі) — заглушка.
export function ChartsScreen() {
  return (
    <ComingSoonScreen
      headerTitle="Графіки"
      icon={LineChart}
      message="Розширені графіки — тренди по місяцях, порівняння категорій у часі — скоро"
    />
  )
}
