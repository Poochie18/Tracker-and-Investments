import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { depositContributionsRepo } from '@/features/investments/repositories/deposit-contributions-repo'
import { useSyncContext } from '@/lib/sync/sync-context'

export const depositContributionKeys = {
  byInvestment: (investmentId: string) => ['deposit-contributions', investmentId] as const,
  all: (userId: string) => ['deposit-contributions', 'all', userId] as const,
}

export function useDepositContributions(investmentId: string | undefined) {
  return useQuery({
    queryKey: depositContributionKeys.byInvestment(investmentId ?? ''),
    queryFn: () => depositContributionsRepo.getByInvestment(investmentId!),
    enabled: !!investmentId,
  })
}

// Всі поповнення користувача одразу — для розрахунку поточної вартості
// кожного депозиту у зведеннях (Огляд, сума по вкладці "Депозити").
export function useAllDepositContributions(userId: string | undefined) {
  return useQuery({
    queryKey: depositContributionKeys.all(userId ?? ''),
    queryFn: () => depositContributionsRepo.getAllForUser(userId!),
    enabled: !!userId,
  })
}

export function useSetDepositContribution(userId: string, investmentId: string) {
  const queryClient = useQueryClient()
  const { triggerSync } = useSyncContext()

  return useMutation({
    mutationFn: ({ monthIndex, amount }: { monthIndex: number; amount: number }) =>
      depositContributionsRepo.upsertMonth(userId, investmentId, monthIndex, amount),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: depositContributionKeys.byInvestment(investmentId) })
      void queryClient.invalidateQueries({ queryKey: depositContributionKeys.all(userId) })
      // Пушимо одразу — не чекаємо 30с планового синку (див. use-investments.ts)
      triggerSync()
    },
  })
}
