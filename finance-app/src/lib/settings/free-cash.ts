import { useSyncExternalStore } from 'react'

// ============================================================
// "Вільні кошти" на вкладці Акції — грошовий залишок на брокерському
// рахунку в доларах, що ще не інвестований (готівка в очікуванні купівлі).
// Свідомо НЕ псевдо-актив у списку акцій (не має тікера/ціни, спотворив би
// підрахунки "Вкладено"/"Прибуток" по реальних паперах) — окреме число,
// показується own рядком під зведенням.
//
// Зберігається в localStorage, як і fiscal-year.ts — НЕ синхронізується
// між пристроями (це свідомий компроміс заради простоти: повний синк
// вимагав би нової таблиці в Supabase + міграції + sync-engine; якщо
// колись знадобиться крос-девайс — переносимо в investments-подібну
// сутність). useFreeCashUsd() — реактивний хук через useSyncExternalStore,
// щоб зміна через пенсіл одразу відображалась в UI без перезавантаження.
// ============================================================

const STORAGE_KEY = 'stocks_free_cash_usd_minor' // копійки (центи) USD

const listeners = new Set<() => void>()

export function getFreeCashUsdMinor(): number {
  const raw = localStorage.getItem(STORAGE_KEY)
  const parsed = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export function setFreeCashUsdMinor(minorUnits: number): void {
  localStorage.setItem(STORAGE_KEY, String(Math.max(0, Math.round(minorUnits))))
  listeners.forEach((l) => l())
}

export function useFreeCashUsdMinor(): number {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    getFreeCashUsdMinor
  )
}
