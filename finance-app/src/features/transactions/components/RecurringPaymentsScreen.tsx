import { Repeat } from 'lucide-react'
import { ComingSoonScreen } from '@/components/ComingSoonScreen'

// Регулярні платежі (підписки, оренда, комунальні) — заглушка.
export function RecurringPaymentsScreen() {
  return (
    <ComingSoonScreen
      headerTitle="Регулярні платежі"
      icon={Repeat}
      message="Підписки, оренда, комунальні — автоматичне нагадування та облік — скоро"
    />
  )
}
