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
  // ЗАВЖДИ у копійках (мінімальних одиницях валюти)! Ціна за одиницю на
  // момент купівлі. Для type==='crypto' може мати дробову частину — деякі
  // токени (PEPE, SHIB, BONK) коштують частки копійки за 1 шт, округлення
  // до цілого занулило б ціну (investments-repo.ts::toPriceMinorUnits).
  purchase_price: number
  current_price: number  // те саме, що purchase_price, але поточна ціна — оновлюється вручну або автосинком (крипта)
  currency: string       // валюта активу, напр. 'UAH', 'USD'
  purchase_date: string  // ISO 8601
  notes: string | null
  // Поля тільки для type === 'deposit' — калькулятор помісячних нарахувань.
  // Для решти типів завжди null.
  interest_rate_percent: number | null // річна процентна ставка, напр. 12.32
  term_months: number | null           // строк вкладу в місяцях
  // Поля тільки для type === 'bond'. Дати виплат — окремо, у bond_coupon_dates.
  // ЗАВЖДИ у копійках! Сума купонної виплати ЗА ОДНУ ШТУКУ, як і purchase_price
  // — при розрахунках множиться на quantity.
  coupon_amount: number | null
  // ЗАВЖДИ у копійках! Сума погашення (номінал) ЗА ОДНУ ШТУКУ, як і
  // purchase_price — може відрізнятись від ціни купівлі (облігація куплена
  // з премією/дисконтом до номіналу). null → береться ціна купівлі за шт.
  redemption_amount: number | null
  // ISO 8601 — дата погашення, вказується явно (не виводиться з дат виплат
  // купонів у bond_coupon_dates, бо вони можуть не збігатись).
  redemption_date: string | null
  // Поле тільки для type === 'crypto' — тікер монети (напр. "BTC") для
  // підтягування курсу з публічного Binance ticker API. null → авто-оновлення
  // ціни недоступне, current_price редагується лише вручну.
  ticker_symbol: string | null
  // 'manual' — введено вручну; 'binance_sync' — рядок створює/оновлює
  // синхронізація балансів з біржі (quantity/current_price оновлює лише
  // синк, purchase_price редагує тільки користувач вручну).
  source: 'manual' | 'binance_sync'
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

// Дата виплати купона (або погашення) облігації — введена вручну.
// Найпізніша дата серед записів investment_id — дата погашення (номінал
// повертається), решта — дати купонних виплат по coupon_amount з Investment.
export interface BondCouponDate {
  id: string
  user_id: string
  investment_id: string
  payment_date: string // ISO 8601 (дата, без часу)
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// Партія (лот) купівлі облігації — кожна покупка (первинна чи докупівля)
// зберігається окремим записом зі своєю датою, кількістю і ціною за штуку.
// investment.quantity — похідне значення, сума кількостей активних лотів
// (bond-lots-repo.ts підтримує його в синхронному стані після кожної зміни
// лота). Купонна виплата на конкретну дату рахується по кількості, що
// фактично була "на руках" на цю дату (bond-schedule.ts: getOutstandingQuantity),
// а не по поточній сумарній кількості — щоб докупівля не задвоювала минулі виплати.
export interface BondLot {
  id: string
  user_id: string
  investment_id: string
  purchase_date: string  // ISO 8601 (дата, без часу)
  quantity: number       // може бути дробовою, як і Investment.quantity
  purchase_price: number // ЗАВЖДИ у копійках! Ціна за одну штуку саме цієї партії.
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// Один рядок зліпку портфеля — суми по типу вкладення в гривневому базисі
// (як у PortfolioSummary), зафіксовані на дату зліпку. pnl/pnlPercent/
// portfolioPercent НЕ зберігаються — рахуються на льоту з invested/
// currentValue (buildPortfolioSummaryFromAmounts), як і в живих даних.
export interface PortfolioSnapshotRow {
  type: InvestmentType
  invested: number      // копійки, гривневий базис
  currentValue: number  // копійки, гривневий базис
}

// Зліпок портфеля на кінець фінансового року — для порівняння "цей рік
// проти минулого". Знімається автоматично при переході в новий фінансовий
// рік (див. use-auto-portfolio-snapshot.ts) або імпортується вручну
// (dev-real-data-importer.ts, з листів "1 ГОД"/"2 ГОД" Excel-трекера).
export interface PortfolioSnapshot {
  id: string
  user_id: string
  fiscal_year_key: string    // напр. "2025-06" — унікальний ключ фін. року (getFiscalYear().key)
  fiscal_year_label: string  // напр. "2025–2026" — для показу користувачу
  snapshot_date: string      // ISO 8601 — дата, на яку знято зліпок
  rates_usd: number          // курс USD на момент зліпку (для перемикача валют)
  rates_eur: number          // курс EUR на момент зліпку
  rows: PortfolioSnapshotRow[]
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

export interface LocalBondCouponDate extends BondCouponDate {
  _sync_status: SyncStatus
  _sync_error: string | null
  _local_updated_at: number
}

export interface LocalBondLot extends BondLot {
  _sync_status: SyncStatus
  _sync_error: string | null
  _local_updated_at: number
}

export interface LocalPortfolioSnapshot extends PortfolioSnapshot {
  _sync_status: SyncStatus
  _sync_error: string | null
  _local_updated_at: number
}

export interface LocalTag extends Tag {
  _sync_status: SyncStatus
  _sync_error: string | null
  _local_updated_at: number
}
