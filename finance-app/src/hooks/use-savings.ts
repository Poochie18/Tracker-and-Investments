import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { savingsRepo } from '@/features/transactions/repositories/savings-repo'
import { useSyncContext } from '@/lib/sync/sync-context'
import type { LocalSavings } from '@/lib/db/schema'

export const savingsKeys = {
  all: (userId: string) => ['savings', userId] as const,
}

export function useSavingsList(userId: string | undefined) {
  return useQuery({
    queryKey: savingsKeys.all(userId ?? ''),
    queryFn: () => savingsRepo.getAll(userId!),
    enabled: !!userId,
  })
}

export function useCreateSavings(userId: string) {
  const queryClient = useQueryClient()
  const { triggerSync } = useSyncContext()

  return useMutation({
    mutationFn: (data: Parameters<typeof savingsRepo.create>[1]) => savingsRepo.create(userId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: savingsKeys.all(userId) })
      triggerSync()
    },
  })
}

export function useUpdateSavings(userId: string) {
  const queryClient = useQueryClient()
  const { triggerSync } = useSyncContext()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof savingsRepo.update>[1] }) =>
      savingsRepo.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: savingsKeys.all(userId) })
      triggerSync()
    },
  })
}

export function useDeleteSavings(userId: string) {
  const queryClient = useQueryClient()
  const { triggerSync } = useSyncContext()

  return useMutation({
    mutationFn: (id: string) => savingsRepo.softDelete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: savingsKeys.all(userId) })
      triggerSync()
    },
  })
}

export type { LocalSavings }
