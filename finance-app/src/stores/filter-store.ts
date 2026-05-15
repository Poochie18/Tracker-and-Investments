import { create } from 'zustand'

// Додаткові фільтри для списку транзакцій.
// Основний period і activeTab — у ui-store.ts.
interface FilterStore {
  categoryFilter: string | null
  setCategoryFilter: (id: string | null) => void
}

export const useFilterStore = create<FilterStore>((set) => ({
  categoryFilter: null,
  setCategoryFilter: (id) => set({ categoryFilter: id }),
}))
