import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bondLotsRepo } from '@/features/investments/repositories/bond-lots-repo'
import { investmentKeys } from './use-investments'

export const bondLotKeys = {
  byInvestment: (investmentId: string) => ['bond-lots', investmentId] as const,
  all: (userId: string) => ['bond-lots', 'all', userId] as const,
}

export function useBondLots(investmentId: string | undefined) {
  return useQuery({
    queryKey: bondLotKeys.byInvestment(investmentId ?? ''),
    queryFn: () => bondLotsRepo.getForInvestment(investmentId!),
    enabled: !!investmentId,
  })
}

// Всі лоти користувача одразу — для зведень (Огляд, сума по вкладці "Облігації").
export function useAllBondLots(userId: string | undefined) {
  return useQuery({
    queryKey: bondLotKeys.all(userId ?? ''),
    queryFn: () => bondLotsRepo.getAllForUser(userId!),
    enabled: !!userId,
  })
}

interface BondLotMutationInput {
  date: string
  quantity: number
  price: number
}

// Кожна мутація лота міняє й investment.quantity (bond-lots-repo.ts
// перераховує його сам) — тому інвалідуємо і лоти, і інвестиції.
function useInvalidateBondLots(userId: string, investmentId: string) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: bondLotKeys.byInvestment(investmentId) })
    void queryClient.invalidateQueries({ queryKey: bondLotKeys.all(userId) })
    void queryClient.invalidateQueries({ queryKey: investmentKeys.all(userId) })
    void queryClient.invalidateQueries({ queryKey: ['investment', investmentId] })
  }
}

export function useAddBondLot(userId: string, investmentId: string) {
  const invalidate = useInvalidateBondLots(userId, investmentId)
  return useMutation({
    mutationFn: (input: BondLotMutationInput) => bondLotsRepo.add(userId, investmentId, input),
    onSuccess: invalidate,
  })
}

export function useUpdateBondLot(userId: string, investmentId: string) {
  const invalidate = useInvalidateBondLots(userId, investmentId)
  return useMutation({
    mutationFn: ({ lotId, input }: { lotId: string; input: BondLotMutationInput }) =>
      bondLotsRepo.update(lotId, input),
    onSuccess: invalidate,
  })
}

export function useDeleteBondLot(userId: string, investmentId: string) {
  const invalidate = useInvalidateBondLots(userId, investmentId)
  return useMutation({
    mutationFn: (lotId: string) => bondLotsRepo.softDelete(lotId),
    onSuccess: invalidate,
  })
}
