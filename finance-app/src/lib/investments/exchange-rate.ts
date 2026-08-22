// ============================================================
// Курси валют НБУ — для перерахунку портфеля інвестицій між
// гривнею та доларом (перемикач валюти на сторінці "Огляд").
//
// Публічне API Нацбанку, ключ не потрібен:
// https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json
//
// Кешуємо в localStorage на кілька годин — курс змінюється раз на день,
// і так само маємо fallback на офлайн/помилку мережі.
// ============================================================

export interface ExchangeRates {
  usd: number // скільки гривень за 1 долар
  eur: number // скільки гривень за 1 євро
  date: string // дата курсу з відповіді НБУ, напр. "22.08.2026"
}

const NBU_URL = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json'
const CACHE_KEY = 'nbu_exchange_rates_cache'
const CACHE_TTL_MS = 1000 * 60 * 60 * 6 // 6 годин

interface NbuRateItem {
  r030: number
  txt: string
  rate: number
  cc: string
  exchangedate: string
}

interface CachedRates {
  rates: ExchangeRates
  fetchedAt: number
}

function readCache(): CachedRates | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CachedRates
  } catch {
    return null
  }
}

function writeCache(rates: ExchangeRates): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rates, fetchedAt: Date.now() } satisfies CachedRates))
  } catch {
    // localStorage недоступний (приватний режим тощо) — просто ігноруємо
  }
}

// Fallback — орієнтовний курс, якщо НБУ недоступний і кешу теж нема.
// Дата пуста — UI показує, що це не актуальний курс.
const FALLBACK_RATES: ExchangeRates = { usd: 44.74, eur: 52.29, date: '' }

export async function fetchExchangeRates(): Promise<ExchangeRates> {
  const cached = readCache()
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rates
  }

  try {
    const res = await fetch(NBU_URL)
    if (!res.ok) throw new Error(`НБУ API повернуло ${res.status}`)
    const data = (await res.json()) as NbuRateItem[]

    const usdItem = data.find((d) => d.cc === 'USD')
    const eurItem = data.find((d) => d.cc === 'EUR')
    if (!usdItem || !eurItem) throw new Error('Курси USD/EUR не знайдено у відповіді НБУ')

    const rates: ExchangeRates = { usd: usdItem.rate, eur: eurItem.rate, date: usdItem.exchangedate }
    writeCache(rates)
    return rates
  } catch {
    // Мережа недоступна / офлайн-режим / CORS — краще застарілий курс, ніж жоден
    return cached?.rates ?? FALLBACK_RATES
  }
}

// Переводить суму (у мінімальних одиницях — копійках/центах) з довільної
// валюти в гривневий базис — щоб можна було підсумовувати активи різних валют.
export function convertToUahMinorUnits(minorUnits: number, currency: string, rates: ExchangeRates): number {
  switch (currency) {
    case 'USD':
      return Math.round(minorUnits * rates.usd)
    case 'EUR':
      return Math.round(minorUnits * rates.eur)
    default:
      return minorUnits
  }
}

// Переводить гривневий базис у валюту відображення (для перемикача UAH/USD)
export function convertFromUahMinorUnits(
  uahMinorUnits: number,
  targetCurrency: 'UAH' | 'USD',
  rates: ExchangeRates
): number {
  if (targetCurrency === 'UAH') return uahMinorUnits
  return Math.round(uahMinorUnits / rates.usd)
}
