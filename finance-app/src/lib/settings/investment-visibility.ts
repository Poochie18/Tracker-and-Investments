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

// useSyncExternalStore вимагає, щоб getSnapshot() повертав СТАБІЛЬНЕ
// посилання, поки дані не змінились — інакше React бачить "новий" стан
// на кожному рендері й зациклюється (React error #185, "Maximum update
// depth exceeded", валило весь застосунок, бо AppLayout обгортає все).
// Кешуємо Set за сирим рядком localStorage — новий об'єкт створюємо
// лише тоді, коли рядок реально змінився.
let cachedRaw: string | null | undefined
let cachedTypes: Set<InvestmentType> = new Set(TOGGLEABLE_INVESTMENT_TYPES)

export function getVisibleInvestmentTypes(): Set<InvestmentType> {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === cachedRaw) return cachedTypes

  cachedRaw = raw
  if (!raw) {
    cachedTypes = new Set(TOGGLEABLE_INVESTMENT_TYPES)
    return cachedTypes
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    cachedTypes = Array.isArray(parsed)
      ? new Set(parsed.filter((t): t is InvestmentType => TOGGLEABLE_INVESTMENT_TYPES.includes(t as InvestmentType)))
      : new Set(TOGGLEABLE_INVESTMENT_TYPES)
  } catch {
    cachedTypes = new Set(TOGGLEABLE_INVESTMENT_TYPES)
  }
  return cachedTypes
}

export function setInvestmentTypeVisible(type: InvestmentType, visible: boolean): void {
  // Копія, а не мутація кешованого Set напряму — той самий об'єкт міг уже
  // піти в React як snapshot з попереднього рендера.
  const next = new Set(getVisibleInvestmentTypes())
  if (visible) next.add(type)
  else next.delete(type)
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
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
