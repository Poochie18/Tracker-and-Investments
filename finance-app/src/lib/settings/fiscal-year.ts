import { useSyncExternalStore } from 'react'

// ============================================================
// Фінансовий рік — користувацьке налаштування (напр. починається
// з червня, а не з січня), потрібне для розбивки прибутку/збитку
// облігацій по роках так, як у листі "АНАЛІЗ ПО ФІНАНСОВИХ РОКАХ"
// оригінального Excel-трекера (01.06 — 31.05 і т.д.).
//
// Зберігається в localStorage (лише UI-налаштування показу, не
// фінансові дані користувача) — синхронізація між пристроями не
// потрібна. useFiscalYearStartMonth() — реактивний хук через
// useSyncExternalStore, щоб зміна в Налаштуваннях одразу
// відображалась в Огляді/Облігаціях без перезавантаження.
// ============================================================

const STORAGE_KEY = 'fiscal_year_start_month'
const DEFAULT_START_MONTH = 6 // червень

export const MONTH_NAMES_UK = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
]

const listeners = new Set<() => void>()

export function getFiscalYearStartMonth(): number {
  const raw = localStorage.getItem(STORAGE_KEY)
  const parsed = raw ? parseInt(raw, 10) : NaN
  return parsed >= 1 && parsed <= 12 ? parsed : DEFAULT_START_MONTH
}

export function setFiscalYearStartMonth(month: number): void {
  localStorage.setItem(STORAGE_KEY, String(month))
  listeners.forEach((l) => l())
}

export function useFiscalYearStartMonth(): number {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    getFiscalYearStartMonth
  )
}

export interface FiscalYear {
  key: string      // унікальний ключ для групування/сортування, напр. "2026-06"
  label: string    // показується користувачу: "2026" (якщо старт — січень) або "2026–2027"
  startDate: Date  // початок фінансового року (включно)
}

// Фінансовий рік, до якого належить дата — календарний рік початку
// відраховується від startMonth (1-12). Якщо місяць дати вже настав
// або дорівнює startMonth — рік починається цього календарного року,
// інакше — з попереднього.
export function getFiscalYear(date: Date, startMonth: number): FiscalYear {
  const month = date.getMonth() + 1 // 1-12
  const year = date.getFullYear()
  const startYear = month >= startMonth ? year : year - 1
  const startDate = new Date(Date.UTC(startYear, startMonth - 1, 1))
  const key = `${startYear}-${String(startMonth).padStart(2, '0')}`
  const label = startMonth === 1 ? String(startYear) : `${startYear}–${startYear + 1}`
  return { key, label, startDate }
}

export function getCurrentFiscalYear(startMonth: number): FiscalYear {
  return getFiscalYear(new Date(), startMonth)
}
