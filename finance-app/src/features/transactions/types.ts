// Типи специфічні для feature "transactions".
// Загальні типи БД — у src/lib/db/schema.ts

export type { TransactionType, LocalTransaction, LocalCategory, LocalAccount } from '@/lib/db/schema'

// Фільтр для вибірки транзакцій
export interface TransactionFilter {
  userId: string
  dateFrom: Date
  dateTo: Date
  type?: 'expense' | 'income'
  categoryId?: string
  accountId?: string
}
