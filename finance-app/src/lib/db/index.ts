import Dexie, { type EntityTable } from 'dexie'
import type {
  LocalAccount, LocalCategory, LocalTransaction, LocalTag, LocalInvestment, LocalDepositContribution,
  LocalBondCouponDate, LocalPortfolioSnapshot,
} from './schema'

// ============================================================
// Dexie — обгортка над IndexedDB для зручної роботи з локальною БД.
// Структура таблиць відповідає Supabase, плюс поля _sync_*.
// ============================================================

export class FinanceDB extends Dexie {
  // Dexie автоматично підтягує типи через EntityTable<T, 'id'>
  accounts!: EntityTable<LocalAccount, 'id'>
  categories!: EntityTable<LocalCategory, 'id'>
  transactions!: EntityTable<LocalTransaction, 'id'>
  tags!: EntityTable<LocalTag, 'id'>
  investments!: EntityTable<LocalInvestment, 'id'>
  depositContributions!: EntityTable<LocalDepositContribution, 'id'>
  bondCouponDates!: EntityTable<LocalBondCouponDate, 'id'>
  portfolioSnapshots!: EntityTable<LocalPortfolioSnapshot, 'id'>

  constructor() {
    super('finance-app-db')

    // Версія 1 схеми.
    // Тут вказуємо ТІЛЬКИ поля для індексів — не всі колонки.
    // ++ = autoincrement (не використовуємо — у нас UUID).
    // & = унікальний індекс.
    // * = мульти-запис (масив).
    this.version(1).stores({
      accounts: '&id, user_id, _sync_status',
      categories: '&id, user_id, type, sort_order, _sync_status',
      transactions: '&id, user_id, account_id, category_id, date, deleted_at, _sync_status',
      tags: '&id, user_id, name',
    })

    // v2: додаємо compound index [user_id+type] для categories —
    // без нього getByType кидає Dexie error і категорії не відображаються
    this.version(2).stores({
      accounts: '&id, user_id, _sync_status',
      categories: '&id, user_id, type, [user_id+type], sort_order, _sync_status',
      transactions: '&id, user_id, account_id, category_id, date, deleted_at, _sync_status',
      tags: '&id, user_id, name',
    })

    // v3: додаємо таблицю investments (Фаза 7 — модуль інвестицій)
    this.version(3).stores({
      accounts: '&id, user_id, _sync_status',
      categories: '&id, user_id, type, [user_id+type], sort_order, _sync_status',
      transactions: '&id, user_id, account_id, category_id, date, deleted_at, _sync_status',
      tags: '&id, user_id, name',
      investments: '&id, user_id, type, deleted_at, _sync_status',
    })

    // v4: додаємо deposit_contributions (помісячні поповнення депозитів)
    this.version(4).stores({
      accounts: '&id, user_id, _sync_status',
      categories: '&id, user_id, type, [user_id+type], sort_order, _sync_status',
      transactions: '&id, user_id, account_id, category_id, date, deleted_at, _sync_status',
      tags: '&id, user_id, name',
      investments: '&id, user_id, type, deleted_at, _sync_status',
      depositContributions: '&id, user_id, investment_id, [investment_id+month_index], _sync_status',
    })

    // v5: додаємо bond_coupon_dates (дати виплат купонів + погашення облігацій)
    this.version(5).stores({
      accounts: '&id, user_id, _sync_status',
      categories: '&id, user_id, type, [user_id+type], sort_order, _sync_status',
      transactions: '&id, user_id, account_id, category_id, date, deleted_at, _sync_status',
      tags: '&id, user_id, name',
      investments: '&id, user_id, type, deleted_at, _sync_status',
      depositContributions: '&id, user_id, investment_id, [investment_id+month_index], _sync_status',
      bondCouponDates: '&id, user_id, investment_id, _sync_status',
    })

    // v6: додаємо portfolio_snapshots (зліпки портфеля по фінансових роках)
    this.version(6).stores({
      accounts: '&id, user_id, _sync_status',
      categories: '&id, user_id, type, [user_id+type], sort_order, _sync_status',
      transactions: '&id, user_id, account_id, category_id, date, deleted_at, _sync_status',
      tags: '&id, user_id, name',
      investments: '&id, user_id, type, deleted_at, _sync_status',
      depositContributions: '&id, user_id, investment_id, [investment_id+month_index], _sync_status',
      bondCouponDates: '&id, user_id, investment_id, _sync_status',
      portfolioSnapshots: '&id, user_id, [user_id+fiscal_year_key], _sync_status',
    })
  }
}

// Singleton — один екземпляр бази на весь додаток
export const db = new FinanceDB()
