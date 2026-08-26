import { create } from 'zustand'

// Zustand store для UI стану, що не є даними з сервера.
// Серверні дані (транзакції, категорії) — через TanStack Query.

export type PeriodType = 'day' | 'week' | 'month' | 'year' | 'custom' | 'all'

interface UIStore {
  selectedPeriod: PeriodType
  setSelectedPeriod: (period: PeriodType) => void

  // Якір, відносно якого рахується день/тиждень/місяць/рік (навігація "вперед-назад").
  // Для 'custom' не використовується — там свій діапазон customFrom/customTo.
  periodAnchor: Date
  setPeriodAnchor: (date: Date) => void
  goToToday: () => void

  // Кастомний діапазон (активний тільки коли selectedPeriod === 'custom')
  customFrom: Date | null
  customTo: Date | null
  setCustomRange: (from: Date, to: Date) => void

  activeTab: 'expense' | 'income'
  setActiveTab: (tab: 'expense' | 'income') => void

  // Активний рахунок (перемикач на Огляді) — null означає "ще не вибрано",
  // тоді компоненти самі фолбечать на перший активний рахунок користувача.
  selectedAccountId: string | null
  setSelectedAccountId: (id: string | null) => void

  isOnline: boolean
  setIsOnline: (val: boolean) => void
}

export const useUIStore = create<UIStore>((set) => ({
  selectedPeriod: 'month',
  // Зміна типу періоду скидає якір на сьогодні — інакше перемикання
  // з "День" (у минулому) на "Місяць" показало б чужий місяць.
  setSelectedPeriod: (period) => set({ selectedPeriod: period, periodAnchor: new Date() }),

  periodAnchor: new Date(),
  setPeriodAnchor: (date) => set({ periodAnchor: date }),
  goToToday: () => set({ periodAnchor: new Date() }),

  customFrom: null,
  customTo: null,
  setCustomRange: (from, to) => set({ customFrom: from, customTo: to, selectedPeriod: 'custom' }),

  activeTab: 'expense',
  setActiveTab: (tab) => set({ activeTab: tab }),

  selectedAccountId: null,
  setSelectedAccountId: (id) => set({ selectedAccountId: id }),

  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setIsOnline: (isOnline) => set({ isOnline }),
}))
