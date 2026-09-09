import { useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase'
import { isLocalOnly } from '@/lib/auth/local-mode'

// ============================================================
// "Вільні кошти" (готівка на брокерському рахунку) і ручне "Вкладено"
// на вкладках "Акції"/"Крипта" — три скалярних налаштування на користувача.
//
// РАНІШЕ жили лише в localStorage (пристрій-специфічно, без реального
// збереження в БД) або виводились із purchase_price активів (крипта,
// scaleInvestedByType) — звідси скарги "поле збивається". Тепер — реальний
// рядок у Supabase (user_investment_settings, міграція 014), з
// localStorage лише як офлайн-кеш для миттєвого читання/офлайн-режиму.
//
// Свідомо НЕ через загальний sync-engine/Dexie (той розрахований на
// списки записів з soft-delete й чергою) — тут один рядок на юзера,
// без списку й без видалення, тож простий read-through кеш + upsert
// напряму в Supabase достатній і на порядок менший за обсягом коду.
// ============================================================

interface InvestmentSettings {
  freeCashUsdMinor: number
  stockManualInvestedUsdMinor: number
  cryptoManualInvestedUsdMinor: number
}

const DEFAULTS: InvestmentSettings = {
  freeCashUsdMinor: 0,
  stockManualInvestedUsdMinor: 0,
  cryptoManualInvestedUsdMinor: 0,
}

const cacheKey = (userId: string) => `investment_settings_cache_${userId}`

const listeners = new Set<() => void>()

// Глобальний кеш останнього прочитаного стану — застосунок одночасно
// показує налаштування лише одного (активного) користувача, як і в
// попередніх free-cash.ts/fiscal-year.ts.
let cachedUserId: string | null = null
let cached: InvestmentSettings = DEFAULTS

function readCache(userId: string): InvestmentSettings {
  const raw = localStorage.getItem(cacheKey(userId))
  if (!raw) return DEFAULTS
  try {
    const parsed = JSON.parse(raw) as Partial<InvestmentSettings>
    return {
      freeCashUsdMinor: Number.isFinite(parsed.freeCashUsdMinor) ? parsed.freeCashUsdMinor! : 0,
      stockManualInvestedUsdMinor: Number.isFinite(parsed.stockManualInvestedUsdMinor)
        ? parsed.stockManualInvestedUsdMinor!
        : 0,
      cryptoManualInvestedUsdMinor: Number.isFinite(parsed.cryptoManualInvestedUsdMinor)
        ? parsed.cryptoManualInvestedUsdMinor!
        : 0,
    }
  } catch {
    return DEFAULTS
  }
}

function writeCache(userId: string, settings: InvestmentSettings): void {
  localStorage.setItem(cacheKey(userId), JSON.stringify(settings))
}

function notify(): void {
  listeners.forEach((l) => l())
}

// getSnapshot для useSyncExternalStore МАЄ повертати стабільну референцію,
// доки значення не змінилось — інакше нескінченний перерендер. cached
// перезаписується лише в set()/pullInvestmentSettings() нижче, при
// збігу userId тут завжди повертаємо той самий об'єкт.
function getSnapshot(userId: string): InvestmentSettings {
  if (cachedUserId !== userId) {
    cachedUserId = userId
    cached = readCache(userId)
  }
  return cached
}

async function set(userId: string, patch: Partial<InvestmentSettings>): Promise<void> {
  const next = { ...getSnapshot(userId), ...patch }
  cached = next
  cachedUserId = userId
  writeCache(userId, next)
  notify()

  // Dev офлайн / гість / світч "локально" — Supabase взагалі не чіпаємо
  // (те саме правило, що для решти сутностей — isLocalOnly).
  if (isLocalOnly(userId)) return

  const { error } = await supabase.from('user_investment_settings').upsert({
    user_id: userId,
    free_cash_usd_minor: next.freeCashUsdMinor,
    stock_manual_invested_usd_minor: next.stockManualInvestedUsdMinor,
    crypto_manual_invested_usd_minor: next.cryptoManualInvestedUsdMinor,
  })
  // Best-effort: якщо офлайн/помилка — значення лишається коректним
  // локально (localStorage-кеш вище), наступний виклик set() чи
  // pullInvestmentSettings() при онлайні узгодить із сервером.
  if (error) {
    console.error('Не вдалось зберегти налаштування інвестицій в Supabase', error)
  }
}

export function setFreeCashUsdMinor(userId: string, minorUnits: number): Promise<void> {
  return set(userId, { freeCashUsdMinor: Math.max(0, Math.round(minorUnits)) })
}

export function setStockManualInvestedUsdMinor(userId: string, minorUnits: number): Promise<void> {
  return set(userId, { stockManualInvestedUsdMinor: Math.max(0, Math.round(minorUnits)) })
}

export function setCryptoManualInvestedUsdMinor(userId: string, minorUnits: number): Promise<void> {
  return set(userId, { cryptoManualInvestedUsdMinor: Math.max(0, Math.round(minorUnits)) })
}

// Підтягує актуальний рядок з Supabase (напр. значення змінили з іншого
// пристрою) — викликається один раз при вході на вкладку "Акції"/"Огляд"
// (InvestmentsScreen). Не критично, якщо не викликати — localStorage-кеш
// із попереднього set() з ЦЬОГО пристрою й так коректний.
export async function pullInvestmentSettings(userId: string): Promise<void> {
  if (isLocalOnly(userId)) return

  const { data, error } = await supabase
    .from('user_investment_settings')
    .select('free_cash_usd_minor, stock_manual_invested_usd_minor, crypto_manual_invested_usd_minor')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return

  cached = {
    freeCashUsdMinor: data.free_cash_usd_minor ?? 0,
    stockManualInvestedUsdMinor: data.stock_manual_invested_usd_minor ?? 0,
    cryptoManualInvestedUsdMinor: data.crypto_manual_invested_usd_minor ?? 0,
  }
  cachedUserId = userId
  writeCache(userId, cached)
  notify()
}

function useInvestmentSettings(userId: string): InvestmentSettings {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    () => getSnapshot(userId)
  )
}

export function useFreeCashUsdMinor(userId: string): number {
  return useInvestmentSettings(userId).freeCashUsdMinor
}

export function useStockManualInvestedUsdMinor(userId: string): number {
  return useInvestmentSettings(userId).stockManualInvestedUsdMinor
}

export function useCryptoManualInvestedUsdMinor(userId: string): number {
  return useInvestmentSettings(userId).cryptoManualInvestedUsdMinor
}
