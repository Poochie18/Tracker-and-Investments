import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { investmentsRepo } from '@/features/investments/repositories/investments-repo'
import type { InvestmentFormData } from '@/features/investments/types'
import type { InvestmentType } from '@/lib/db/schema'
import { useSyncContext } from '@/lib/sync/sync-context'

export const investmentKeys = {
  all: (userId: string) => ['investments', userId] as const,
  // Окремий запис (форма редагування, AddInvestmentScreen) — своя queryKey,
  // не 'investments'-список, тому мутації нижче мають інвалідовувати ОБИДВІ
  // (див. коментар у useUpdateInvestment) — інакше форма при повторному
  // відкритті бачить старе кешоване значення (звідси "ціна відкотилась").
  detail: (id: string) => ['investment', id] as const,
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
    queryKey: investmentKeys.detail(id ?? ''),
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
    // Інвалідовуємо і список ('investments'), і окремий запис ('investment',
    // id) — форма редагування (useInvestment) тримає СВІЙ кеш, без цього
    // при повторному відкритті форми показувались би дані на момент першого
    // відкриття (звідси баг "ціна відкочується до створення картки").
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: investmentKeys.all(userId) })
      void queryClient.invalidateQueries({ queryKey: investmentKeys.detail(id) })
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
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: investmentKeys.all(userId) })
      void queryClient.invalidateQueries({ queryKey: investmentKeys.detail(id) })
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
      // Торкається N рядків одразу (конкретні id наперед невідомі) — б'ємо
      // по всьому префіксу 'investment', а не по одному detail(id).
      void queryClient.invalidateQueries({ queryKey: ['investment'] })
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
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: investmentKeys.all(userId) })
      void queryClient.invalidateQueries({ queryKey: investmentKeys.detail(id) })
      triggerSync()
    },
  })
}

export function useDeleteInvestment(userId: string) {
  const queryClient = useQueryClient()
  const { triggerSync } = useSyncContext()

  return useMutation({
    mutationFn: (id: string) => investmentsRepo.softDelete(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: investmentKeys.all(userId) })
      void queryClient.invalidateQueries({ queryKey: investmentKeys.detail(id) })
      triggerSync()
    },
  })
}
