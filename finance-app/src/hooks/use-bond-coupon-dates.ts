import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bondCouponDatesRepo } from '@/features/investments/repositories/bond-coupon-dates-repo'

export const bondCouponDateKeys = {
  byInvestment: (investmentId: string) => ['bond-coupon-dates', investmentId] as const,
  all: (userId: string) => ['bond-coupon-dates', 'all', userId] as const,
}

export function useBondCouponDates(investmentId: string | undefined) {
  return useQuery({
    queryKey: bondCouponDateKeys.byInvestment(investmentId ?? ''),
    queryFn: () => bondCouponDatesRepo.getForInvestment(investmentId!),
    enabled: !!investmentId,
  })
}

// Всі дати користувача одразу — для зведень (Огляд, сума по вкладці "Облігації").
export function useAllBondCouponDates(userId: string | undefined) {
  return useQuery({
    queryKey: bondCouponDateKeys.all(userId ?? ''),
    queryFn: () => bondCouponDatesRepo.getAllForUser(userId!),
    enabled: !!userId,
  })
}

export function useSetBondCouponDates(userId: string, investmentId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (dates: string[]) => bondCouponDatesRepo.replaceAll(userId, investmentId, dates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bondCouponDateKeys.byInvestment(investmentId) })
      void queryClient.invalidateQueries({ queryKey: bondCouponDateKeys.all(userId) })
    },
  })
}
