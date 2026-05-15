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

export interface LocalTag extends Tag {
  _sync_status: SyncStatus
  _sync_error: string | null
  _local_updated_at: number
}
