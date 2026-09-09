import { useSyncExternalStore } from 'react'
import type { InvestmentType } from '@/lib/db/schema'

// ============================================================
// Які вкладки типів інвестицій показувати в другому ряду навігації
// (SecondaryNav в AppLayout.tsx) — користувацьке налаштування, аналог
// до "Рахунки" (чекбокси в Налаштуваннях). "Огляд" ховати не можна —
// стосується лише вкладок конкретного типу.
//
// Зберігається в localStorage (лише UI-налаштування показу, не фінансові
// дані) — синхронізація між пристроями не потрібна, як і fiscal-year.ts.
// ============================================================

const STORAGE_KEY = 'investments_visible_types'

// Типи, для яких взагалі існує вкладка в SecondaryNav (не 'other' — той
// без вкладки, див. ADDABLE_INVESTMENT_TYPES коментар у investments/types.ts).
export const TOGGLEABLE_INVESTMENT_TYPES: InvestmentType[] = ['deposit', 'bond', 'crypto', 'stock']

// Ті самі підписи, що й у SecondaryNav (AppLayout.tsx) — множина, на
// відміну від INVESTMENT_TYPE_META.label (однина, "Акція"/"Депозит").
export const TOGGLEABLE_TYPE_LABELS: Record<InvestmentType, string> = {
  deposit: 'Депозити',
  bond: 'Облігації',
  crypto: 'Крипта',
  stock: 'Акції',
  other: 'Інше',
}

const listeners = new Set<() => void>()

export function getVisibleInvestmentTypes(): Set<InvestmentType> {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return new Set(TOGGLEABLE_INVESTMENT_TYPES)
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set(TOGGLEABLE_INVESTMENT_TYPES)
    const valid = parsed.filter((t): t is InvestmentType => TOGGLEABLE_INVESTMENT_TYPES.includes(t as InvestmentType))
    return new Set(valid)
  } catch {
    return new Set(TOGGLEABLE_INVESTMENT_TYPES)
  }
}

export function setInvestmentTypeVisible(type: InvestmentType, visible: boolean): void {
  const current = getVisibleInvestmentTypes()
  if (visible) current.add(type)
  else current.delete(type)
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...current]))
  listeners.forEach((l) => l())
}

export function useVisibleInvestmentTypes(): Set<InvestmentType> {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    getVisibleInvestmentTypes
  )
}
