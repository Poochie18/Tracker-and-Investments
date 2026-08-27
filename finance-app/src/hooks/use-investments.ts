import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { investmentsRepo } from '@/features/investments/repositories/investments-repo'
import type { InvestmentFormData } from '@/features/investments/types'
import type { InvestmentType } from '@/lib/db/schema'
import { useSyncContext } from '@/lib/sync/sync-context'

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
  const { triggerSync } = useSyncContext()

  return useMutation({
    mutationFn: (data: InvestmentFormData) => investmentsRepo.create(userId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: investmentKeys.all(userId) })
      // Пушимо в Supabase одразу — без цього новий запис (напр. депозит)
      // чекав би до 30с планового синку і міг загубитись, якщо застосунок
      // закрили раніше (звідси скарги "депозит з телефону не видно на ПК").
      triggerSync()
    },
  })
}

export function useUpdateInvestment(userId: string) {
  const queryClient = useQueryClient()
  const { triggerSync } = useSyncContext()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: InvestmentFormData }) =>
      investmentsRepo.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: investmentKeys.all(userId) })
      triggerSync()
    },
  })
}

export function useUpdateInvestmentPrice(userId: string) {
  const queryClient = useQueryClient()
  const { triggerSync } = useSyncContext()

  return useMutation({
    mutationFn: ({ id, currentPrice }: { id: string; currentPrice: number }) =>
      investmentsRepo.updateCurrentPrice(id, currentPrice),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: investmentKeys.all(userId) })
      triggerSync()
    },
  })
}

// Пенсіл біля АГРЕГОВАНОГО "Вкладено" (Крипта, Акції) — масштабує
// собівартість усіх рядків заданого типу пропорційно, щоб їх сума стала
// новим введеним значенням (див. investmentsRepo.scaleInvestedByType).
export function useScaleInvestedByType(userId: string, type: InvestmentType) {
  const queryClient = useQueryClient()
  const { triggerSync } = useSyncContext()

  return useMutation({
    mutationFn: (newTotalUnits: number) => investmentsRepo.scaleInvestedByType(userId, type, newTotalUnits),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: investmentKeys.all(userId) })
      triggerSync()
    },
  })
}

// "Докупити" акцію (InvestmentsScreen → StockListItem → StockBuySheet) —
// кількість підсумовується, ціна усереднюється (investmentsRepo.buyMoreStock).
export function useBuyMoreStock(userId: string) {
  const queryClient = useQueryClient()
  const { triggerSync } = useSyncContext()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { date: string; quantity: number; price: number } }) =>
      investmentsRepo.buyMoreStock(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: investmentKeys.all(userId) })
      triggerSync()
    },
  })
}

export function useDeleteInvestment(userId: string) {
  const queryClient = useQueryClient()
  const { triggerSync } = useSyncContext()

  return useMutation({
    mutationFn: (id: string) => investmentsRepo.softDelete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: investmentKeys.all(userId) })
      triggerSync()
    },
  })
}
