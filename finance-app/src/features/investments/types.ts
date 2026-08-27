// Типи специфічні для feature "investments".
// Загальні типи БД — у src/lib/db/schema.ts

export type { InvestmentType, LocalInvestment } from '@/lib/db/schema'

import type { InvestmentType } from '@/lib/db/schema'

// Метадані для відображення типу активу (іконка, підпис, колір)
export interface InvestmentTypeMeta {
  label: string
  iconName: string
  colorHex: string
}

export const INVESTMENT_TYPE_META: Record<InvestmentType, InvestmentTypeMeta> = {
  stock: { label: 'Акція', iconName: 'TrendingUp', colorHex: '#4A90E2' },
  crypto: { label: 'Крипта', iconName: 'Bitcoin', colorHex: '#F4B942' },
  bond: { label: 'Облігація', iconName: 'FileText', colorHex: '#9CB861' },
  deposit: { label: 'Депозит', iconName: 'Landmark', colorHex: '#00C896' },
  other: { label: 'Інше', iconName: 'MoreHorizontal', colorHex: '#B0B0B0' },
}

export const INVESTMENT_TYPES: InvestmentType[] = ['stock', 'crypto', 'bond', 'deposit', 'other']

// Типи, які можна створити вручну через форму "Новий актив". "Інше" сюди
// не входить — цей тип лишився без вкладки в нижній навігації (недосяжний
// після створення), тож додавати нові такі активи більше нема сенсу.
// Крипту, навпаки, МОЖНА додати вручну (source='manual') — не в кожного є
// ключ Binance, і хтось хоче просто вести облік монет самостійно. Такі
// рядки поводяться як звичайний актив (їх видно/можна редагувати через
// InvestmentListItem, на відміну від синхронізованих з Binance — джерело
// зберігається в investment.source і не змінюється manual-редагуванням,
// investments-repo.ts:update).
export const ADDABLE_INVESTMENT_TYPES: InvestmentType[] = INVESTMENT_TYPES.filter((t) => t !== 'other')

// Дані форми додавання/редагування активу (суми у гривнях/валюті, не в копійках)
export interface InvestmentFormData {
  name: string
  type: InvestmentType
  quantity: number
  purchasePrice: number  // за одиницю, у валюті (не копійки)
  currentPrice: number   // за одиницю, у валюті (не копійки)
  currency: string
  purchaseDate: Date
  notes?: string
  // Тільки для type === 'deposit' — калькулятор помісячних нарахувань
  interestRatePercent?: number
  termMonths?: number
  // Тільки для type === 'bond'
  couponAmount?: number      // сума купонної виплати ЗА 1 ШТ, як ціна купівлі (у валюті активу)
  redemptionAmount?: number  // сума погашення (номінал) ЗА 1 ШТ, як ціна купівлі (у валюті активу)
  redemptionDate?: Date      // дата погашення
  // Тільки для type === 'crypto' (Binance) або 'stock' (Finnhub) — тікер
  // для автопідтягування курсу/ціни (напр. "BTC", "AAPL")
  tickerSymbol?: string
}
