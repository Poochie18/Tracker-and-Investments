import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { investmentsRepo } from '@/features/investments/repositories/investments-repo'
import type { InvestmentFormData } from '@/features/investments/types'

export const investmentKeys = {
  all: (userId: string) => ['investments', userId] as const,
}

// Всі активні інвестиції користувача
export function useInvestments(userId: string | undefined) {
  return useQuery({
    queryKey: investmentKeys.all(userId ?? ''),
    queryFn: () => investmentsRepo.getAll(userId!),
    enabled: !!userId,
  })
}

export function useInvestment(id: string | undefined) {
  return useQuery({
    queryKey: ['investment', id],
    queryFn: () => investmentsRepo.getById(id!),
    enabled: !!id,
  })
}

export function useCreateInvestment(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: InvestmentFormData) => investmentsRepo.create(userId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: investmentKeys.all(userId) })
    },
  })
}

export function useUpdateInvestment(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: InvestmentFormData }) =>
      investmentsRepo.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: investmentKeys.all(userId) })
    },
  })
}

export function useUpdateInvestmentPrice(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, currentPrice }: { id: string; currentPrice: number }) =>
      investmentsRepo.updateCurrentPrice(id, currentPrice),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: investmentKeys.all(userId) })
    },
  })
}

// Пенсіл біля АГРЕГОВАНОГО "Вкладено" на вкладці Крипта — масштабує
// собівартість усіх крипто-рядків користувача пропорційно, щоб їх сума
// стала новим введеним значенням (див. investmentsRepo.scaleCryptoInvested).
export function useScaleCryptoInvested(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (newTotalUnits: number) => investmentsRepo.scaleCryptoInvested(userId, newTotalUnits),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: investmentKeys.all(userId) })
    },
  })
}

export function useDeleteInvestment(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => investmentsRepo.softDelete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: investmentKeys.all(userId) })
    },
  })
}
