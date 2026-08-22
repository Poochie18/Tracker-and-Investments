import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { depositContributionsRepo } from '@/features/investments/repositories/deposit-contributions-repo'

export const depositContributionKeys = {
  byInvestment: (investmentId: string) => ['deposit-contributions', investmentId] as const,
}

export function useDepositContributions(investmentId: string | undefined) {
  return useQuery({
    queryKey: depositContributionKeys.byInvestment(investmentId ?? ''),
    queryFn: () => depositContributionsRepo.getByInvestment(investmentId!),
    enabled: !!investmentId,
  })
}

export function useSetDepositContribution(userId: string, investmentId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ monthIndex, amount }: { monthIndex: number; amount: number }) =>
      depositContributionsRepo.upsertMonth(userId, investmentId, monthIndex, amount),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: depositContributionKeys.byInvestment(investmentId) })
    },
  })
}
