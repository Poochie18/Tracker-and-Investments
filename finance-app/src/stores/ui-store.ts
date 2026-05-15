import { create } from 'zustand'

// Zustand store для UI стану, що не є даними з сервера.
// Серверні дані (транзакції, категорії) — через TanStack Query.

export type PeriodType = 'day' | 'week' | 'month' | 'year' | 'custom'

interface UIStore {
  selectedPeriod: PeriodType
  setSelectedPeriod: (period: PeriodType) => void

  // Кастомний діапазон (активний тільки коли selectedPeriod === 'custom')
  customFrom: Date | null
  customTo: Date | null
  setCustomRange: (from: Date, to: Date) => void

  activeTab: 'expense' | 'income'
  setActiveTab: (tab: 'expense' | 'income') => void

  isOnline: boolean
  setIsOnline: (val: boolean) => void
}

export const useUIStore = create<UIStore>((set) => ({
  selectedPeriod: 'month',
  setSelectedPeriod: (period) => set({ selectedPeriod: period }),

  customFrom: null,
  customTo: null,
  setCustomRange: (from, to) => set({ customFrom: from, customTo: to, selectedPeriod: 'custom' }),

  activeTab: 'expense',
  setActiveTab: (tab) => set({ activeTab: tab }),

  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setIsOnline: (isOnline) => set({ isOnline }),
}))
