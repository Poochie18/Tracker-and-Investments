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
  crypto: { label: 'Криптовалюта', iconName: 'Bitcoin', colorHex: '#F4B942' },
  bond: { label: 'Облігація', iconName: 'FileText', colorHex: '#9CB861' },
  deposit: { label: 'Депозит', iconName: 'Landmark', colorHex: '#00C896' },
  other: { label: 'Інше', iconName: 'MoreHorizontal', colorHex: '#B0B0B0' },
}

export const INVESTMENT_TYPES: InvestmentType[] = ['stock', 'crypto', 'bond', 'deposit', 'other']

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
}
