import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { categoriesRepo } from '@/features/transactions/repositories/categories-repo'
import type { TransactionType, LocalCategory } from '@/lib/db/schema'
import { useSyncContext } from '@/lib/sync/sync-context'

// Ключі для кешу TanStack Query.
// Виносимо в одне місце щоб легко інвалідувати.
export const categoryKeys = {
  all: (userId: string) => ['categories', userId] as const,
  byType: (userId: string, type: TransactionType) => ['categories', userId, type] as const,
}

// Всі категорії користувача (не архівовані)
export function useCategories(userId: string | undefined) {
  return useQuery({
    queryKey: categoryKeys.all(userId ?? ''),
    queryFn: () => categoriesRepo.getAll(userId!),
    enabled: !!userId,
    // Категорії змінюються рідко — кешуємо на 5 хвилин
    staleTime: 1000 * 60 * 5,
  })
}

// Категорії певного типу
export function useCategoriesByType(userId: string | undefined, type: TransactionType) {
  return useQuery({
    queryKey: categoryKeys.byType(userId ?? '', type),
    queryFn: () => categoriesRepo.getByType(userId!, type),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  })
}

// Мутація для створення категорії
export function useCreateCategory(userId: string) {
  const queryClient = useQueryClient()
  const { triggerSync } = useSyncContext()

  return useMutation({
    mutationFn: (data: Pick<LocalCategory, 'name' | 'type' | 'icon_name' | 'color_hex'>) =>
      categoriesRepo.create(userId, data),
    // Після успіху — інвалідуємо кеш, UI перечитає дані
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all(userId) })
      triggerSync()
    },
  })
}

// Мутація для архівування
export function useArchiveCategory(userId: string) {
  const queryClient = useQueryClient()
  const { triggerSync } = useSyncContext()

  return useMutation({
    mutationFn: (id: string) => categoriesRepo.archive(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all(userId) })
      triggerSync()
    },
  })
}
