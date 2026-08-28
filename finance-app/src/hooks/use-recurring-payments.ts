import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { recurringPaymentsRepo } from '@/features/transactions/repositories/recurring-payments-repo'
import { transactionsRepo } from '@/features/transactions/repositories/transactions-repo'
import { getDueOccurrences } from '@/features/transactions/recurring-schedule'
import { transactionKeys } from './use-transactions'
import { useSyncContext } from '@/lib/sync/sync-context'
import type { LocalRecurringPayment, RecurringFrequency, TransactionType } from '@/lib/db/schema'

export const recurringPaymentKeys = {
  all: (userId: string) => ['recurring-payments', userId] as const,
}

// Усі регулярні платежі користувача (активні і призупинені — фільтр
// показу робить UI).
export function useRecurringPayments(userId: string | undefined) {
  return useQuery({
    queryKey: recurringPaymentKeys.all(userId ?? ''),
    queryFn: () => recurringPaymentsRepo.getAll(userId!),
    enabled: !!userId,
  })
}

export function useRecurringPayment(id: string | undefined) {
  return useQuery({
    queryKey: ['recurring-payment', id],
    queryFn: () => recurringPaymentsRepo.getById(id!),
    enabled: !!id,
  })
}

// Для кожного активного платежу генерує звичайні транзакції за всі дати,
// що настали з моменту last_generated_date (або start_date, якщо ще не
// генерували) до "зараз" — включно з пропущеними, якщо застосунок довго
// не відкривали (кожна дата — окрема транзакція з датою цього випадку).
// Не хук — звичайна async-функція, щоб її можна було викликати і з
// use-recurring-auto-generate.ts (при вході/періодично), і напряму з
// onSuccess мутацій нижче (щоб перший випадок з'явився миттєво).
export async function generateDueRecurringTransactions(userId: string): Promise<number> {
  const all = await recurringPaymentsRepo.getAll(userId)
  const now = new Date().toISOString()
  let generatedCount = 0

  for (const recurring of all) {
    if (!recurring.is_active) continue
    const dueDates = getDueOccurrences(recurring, now)
    if (dueDates.length === 0) continue

    for (const dateKey of dueDates) {
      const [hours, minutes] = recurring.start_time.split(':').map(Number)
      const occurrenceDate = new Date(`${dateKey}T00:00:00`)
      occurrenceDate.setHours(hours || 0, minutes || 0, 0, 0)

      await transactionsRepo.create(userId, {
        account_id: recurring.account_id,
        category_id: recurring.category_id,
        type: recurring.type,
        amount: recurring.amount,
        currency: recurring.currency,
        date: occurrenceDate,
        comment: recurring.comment ?? recurring.name,
      })
      generatedCount++
    }

    await recurringPaymentsRepo.markGenerated(recurring.id, dueDates[dueDates.length - 1])
  }

  return generatedCount
}

export function useCreateRecurringPayment(userId: string) {
  const queryClient = useQueryClient()
  const { triggerSync } = useSyncContext()

  return useMutation({
    mutationFn: (data: Parameters<typeof recurringPaymentsRepo.create>[1]) =>
      recurringPaymentsRepo.create(userId, data),
    onSuccess: async () => {
      // Генеруємо одразу — якщо start_date вже настав, перша транзакція
      // має з'явитись негайно, а не чекати наступної перевірки автосинку.
      await generateDueRecurringTransactions(userId)
      void queryClient.invalidateQueries({ queryKey: recurringPaymentKeys.all(userId) })
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all(userId) })
      triggerSync()
    },
  })
}

export function useUpdateRecurringPayment(userId: string) {
  const queryClient = useQueryClient()
  const { triggerSync } = useSyncContext()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof recurringPaymentsRepo.update>[1] }) =>
      recurringPaymentsRepo.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: recurringPaymentKeys.all(userId) })
      triggerSync()
    },
  })
}

// Увімкнути/призупинити — спосіб "виключити" платіж без видалення.
export function useSetRecurringPaymentActive(userId: string) {
  const queryClient = useQueryClient()
  const { triggerSync } = useSyncContext()

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      recurringPaymentsRepo.setActive(id, isActive),
    onSuccess: async (_, { isActive }) => {
      // Відновили після паузи — одразу наздоганяємо пропущені дати.
      if (isActive) await generateDueRecurringTransactions(userId)
      void queryClient.invalidateQueries({ queryKey: recurringPaymentKeys.all(userId) })
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all(userId) })
      triggerSync()
    },
  })
}

export function useDeleteRecurringPayment(userId: string) {
  const queryClient = useQueryClient()
  const { triggerSync } = useSyncContext()

  return useMutation({
    mutationFn: (id: string) => recurringPaymentsRepo.softDelete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: recurringPaymentKeys.all(userId) })
      triggerSync()
    },
  })
}

// Використовується формою — типи тут лише щоб не імпортувати schema.ts
// у кожному місці окремо.
export type { RecurringFrequency, TransactionType, LocalRecurringPayment }
