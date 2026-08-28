import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from './use-auth'
import { generateDueRecurringTransactions, recurringPaymentKeys } from './use-recurring-payments'
import { transactionKeys } from './use-transactions'
import { onlineDetector } from '@/lib/sync/online-detector'

// Дні розкладу рахуються подобово (не по годинах), тож немає сенсу
// перевіряти частіше — година з запасом покриває навіть той рідкий
// випадок, коли застосунок лишили відкритим рівно на межі доби.
const CHECK_INTERVAL_MS = 60 * 60 * 1000

// "Наздоганяюча" генерація регулярних платежів — при вході в застосунок,
// при поверненні з фону, і раз на годину, поки він відкритий. Якщо
// застосунок довго не відкривали — генерує всі пропущені дати одразу
// (getDueOccurrences сама повертає весь список). Монтується один раз в
// AppLayout.tsx, за тим самим паттерном, що і use-price-auto-sync.ts.
export function useRecurringAutoGenerate(): void {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()
  const runningRef = useRef(false)

  useEffect(() => {
    if (!userId) return

    const check = () => {
      if (runningRef.current || !onlineDetector.isOnline) return
      runningRef.current = true
      void generateDueRecurringTransactions(userId)
        .then((count) => {
          if (count > 0) {
            void queryClient.invalidateQueries({ queryKey: recurringPaymentKeys.all(userId) })
            void queryClient.invalidateQueries({ queryKey: transactionKeys.all(userId) })
          }
        })
        .finally(() => {
          runningRef.current = false
        })
    }

    check()

    const intervalId = setInterval(check, CHECK_INTERVAL_MS)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [userId, queryClient])
}
