// ============================================================
// Типи, що відповідають схемі бази даних (Supabase + Dexie).
// ============================================================

// Статус синхронізації запису в локальній IndexedDB
export type SyncStatus = 'synced' | 'pending' | 'error'

// Тип транзакції
export type TransactionType = 'expense' | 'income'

// ──────────────────────────────────────────────────────────
// Supabase (хмарні) типи — відповідають колонкам у PostgreSQL
// ──────────────────────────────────────────────────────────

export interface Account {
  id: string
  user_id: string
  name: string
  currency: string
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  type: TransactionType
  icon_name: string   // назва іконки з lucide-react, напр. "Heart"
  color_hex: string   // формат #RRGGBB
  sort_order: number
  is_archived: boolean
  is_system: boolean  // системні категорії не можна видалити
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  user_id: string
  account_id: string
  category_id: string
  type: TransactionType
  amount: number      // ЗАВЖДИ у копійках! Ніколи не зберігай float.
  currency: string
  date: string        // ISO 8601
  comment: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null  // null = активна, не-null = видалена (soft delete)
}

// Тип інвестиційного активу
export type InvestmentType = 'stock' | 'crypto' | 'bond' | 'deposit' | 'other'

export interface Investment {
  id: string
  user_id: string
  name: string          // напр. "Apple Inc." або "Bitcoin"
  type: InvestmentType
  quantity: number       // кількість одиниць/акцій/монет (може бути дробовою)
  purchase_price: number // ЗАВЖДИ у копійках (мінімальних одиницях валюти)! Ціна за одиницю на момент купівлі.
  current_price: number  // ЗАВЖДИ у копійках! Поточна ціна за одиницю — оновлюється вручну.
  currency: string       // валюта активу, напр. 'UAH', 'USD'
  purchase_date: string  // ISO 8601
  notes: string | null
  // Поля тільки для type === 'deposit' — калькулятор помісячних нарахувань.
  // Для решти типів завжди null.
  interest_rate_percent: number | null // річна процентна ставка, напр. 12.32
  term_months: number | null           // строк вкладу в місяцях
  created_at: string
  updated_at: string
  deleted_at: string | null  // null = активна, не-null = видалена (soft delete)
}

// Поповнення депозиту за конкретний місяць — введене користувачем вручну.
// Нарахування відсотків і залишок на кінець місяця НЕ зберігаються —
// вони завжди рахуються на льоту з initial amount + rate + список поповнень
// (deposit-schedule.ts), щоб не було розсинхрону.
export interface DepositContribution {
  id: string
  user_id: string
  investment_id: string
  month_index: number // 0 = місяць відкриття вкладу, 1, 2, ... до term_months
  amount: number       // ЗАВЖДИ у копійках! Сума поповнення за цей місяць.
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Tag {
  id: string
  user_id: string
  name: string
}

export interface TransactionTag {
  transaction_id: string
  tag_id: string
}

// ──────────────────────────────────────────────────────────
// Локальні типи Dexie (IndexedDB) — розширюють хмарні типи
// додатковими полями для відстеження синхронізації
// ──────────────────────────────────────────────────────────

export interface LocalAccount extends Account {
  _sync_status: SyncStatus
  _sync_error: string | null
  _local_updated_at: number  // Unix timestamp (ms) останнього локального запису
}

export interface LocalCategory extends Category {
  _sync_status: SyncStatus
  _sync_error: string | null
  _local_updated_at: number
}

export interface LocalTransaction extends Transaction {
  _sync_status: SyncStatus
  _sync_error: string | null
  _local_updated_at: number
}

export interface LocalInvestment extends Investment {
  _sync_status: SyncStatus
  _sync_error: string | null
  _local_updated_at: number
}

export interface LocalDepositContribution extends DepositContribution {
  _sync_status: SyncStatus
  _sync_error: string | null
  _local_updated_at: number
}

export interface LocalTag extends Tag {
  _sync_status: SyncStatus
  _sync_error: string | null
  _local_updated_at: number
}
