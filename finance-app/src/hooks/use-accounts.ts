import { useQuery } from '@tanstack/react-query'
import { accountsRepo } from '@/features/transactions/repositories/accounts-repo'

// Активні рахунки користувача — для перемикача на Огляді, вибору
// рахунку в транзакціях, і фолбеку "перший рахунок", якщо ще нічого
// не вибрано (див. selectedAccountId в ui-store).
export function useAccounts(userId: string | undefined) {
  return useQuery({
    queryKey: ['accounts', userId],
    queryFn: () => accountsRepo.getActive(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
  })
}
