import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { transactionsRepo } from '@/features/transactions/repositories/transactions-repo'
import type { TransactionFilter } from '@/features/transactions/types'
import type { TransactionType } from '@/lib/db/schema'

export const transactionKeys = {
  all: (userId: string) => ['transactions', userId] as const,
  filtered: (userId: string, filter: Omit<TransactionFilter, 'userId'>) =>
    ['transactions', userId, filter] as const,
}

// Транзакції за фільтром (дата, тип, категорія)
export function useTransactions(filter: TransactionFilter) {
  return useQuery({
    queryKey: transactionKeys.filtered(filter.userId, {
      dateFrom: filter.dateFrom,
      dateTo: filter.dateTo,
      type: filter.type,
      categoryId: filter.categoryId,
      accountId: filter.accountId,
    }),
    queryFn: () => transactionsRepo.getByFilter(filter),
    enabled: !!filter.userId,
  })
}

// Одна транзакція за id — для екрану редагування
export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: ['transaction', id],
    queryFn: () => transactionsRepo.getById(id!),
    enabled: !!id,
  })
}

// Сума по типу за фільтром (для показу балансу)
export function useTransactionSum(filter: TransactionFilter, type: TransactionType) {
  return useQuery({
    queryKey: [...transactionKeys.filtered(filter.userId, filter), 'sum', type],
    queryFn: () => transactionsRepo.sumByType(filter, type),
    enabled: !!filter.userId,
  })
}

// Мутація: створити транзакцію
export function useCreateTransaction(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Parameters<typeof transactionsRepo.create>[1]) =>
      transactionsRepo.create(userId, data),
    onSuccess: () => {
      // Інвалідуємо всі запити транзакцій — перечитуємо з Dexie
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all(userId) })
    },
  })
}

// Мутація: видалити (soft delete)
export function useDeleteTransaction(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => transactionsRepo.softDelete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all(userId) })
    },
  })
}

// Мутація: редагувати
export function useUpdateTransaction(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Parameters<typeof transactionsRepo.update>[1]
    }) => transactionsRepo.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all(userId) })
    },
  })
}
