import { useSyncExternalStore } from 'react'

// ============================================================
// "Вкладено" на вкладці Акції — введене вручну, скільки власних коштів
// реально внесено на купівлю акцій. НЕ похідне від purchase_price*quantity
// (та сума тепер показується окремо як "Ціна купівлі") і ні з чим не
// підсумовується — суто інформаційне число, яке користувач сам оновлює
// через пенсіл біля плитки "Вкладено".
//
// Зберігається в localStorage, як і free-cash.ts — НЕ синхронізується
// між пристроями (той самий свідомий компроміс, що й для вільних коштів).
// ============================================================

const STORAGE_KEY = 'stocks_manual_invested_usd_minor' // копійки (центи) USD

const listeners = new Set<() => void>()

export function getStockManualInvestedUsdMinor(): number {
  const raw = localStorage.getItem(STORAGE_KEY)
  const parsed = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export function setStockManualInvestedUsdMinor(minorUnits: number): void {
  localStorage.setItem(STORAGE_KEY, String(Math.max(0, Math.round(minorUnits))))
  listeners.forEach((l) => l())
}

export function useStockManualInvestedUsdMinor(): number {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    getStockManualInvestedUsdMinor
  )
}
