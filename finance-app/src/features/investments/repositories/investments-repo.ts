import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import type { LocalInvestment } from '@/lib/db/schema'
import type { InvestmentFormData } from '../types'
import { bondLotsRepo } from './bond-lots-repo'

// Репозиторій для роботи з інвестиціями через Dexie (IndexedDB).
// Той самий патерн, що і transactions-repo / categories-repo:
// пишемо тільки локально, _sync_status='pending' підхоплює sync-engine.

export const investmentsRepo = {
  // Всі активні (не видалені) інвестиції користувача
  async getAll(userId: string): Promise<LocalInvestment[]> {
    return db.investments
      .where('user_id')
      .equals(userId)
      .filter((i) => i.deleted_at === null)
      .sortBy('created_at')
  },

  async getById(id: string): Promise<LocalInvestment | undefined> {
    return db.investments.get(id)
  },

  async create(userId: string, data: InvestmentFormData): Promise<LocalInvestment> {
    const now = new Date().toISOString()
    // Для облігацій "поточну ціну" не вводимо окремо (тримаємо до погашення
    // за номіналом) — дзеркалимо ціну купівлі, щоб не ламати підсумки портфеля.
    const currentPrice = data.type === 'bond' ? data.purchasePrice : data.currentPrice
    const investment: LocalInvestment = {
      id: uuidv4(),
      user_id: userId,
      name: data.name,
      type: data.type,
      quantity: data.quantity,
      purchase_price: Math.round(data.purchasePrice * 100),
      current_price: Math.round(currentPrice * 100),
      currency: data.currency,
      purchase_date: data.purchaseDate.toISOString(),
      notes: data.notes?.trim() || null,
      interest_rate_percent: data.type === 'deposit' ? data.interestRatePercent ?? null : null,
      term_months: data.type === 'deposit' ? data.termMonths ?? null : null,
      coupon_amount: data.type === 'bond' && data.couponAmount != null ? Math.round(data.couponAmount * 100) : null,
      redemption_amount: data.type === 'bond' && data.redemptionAmount != null ? Math.round(data.redemptionAmount * 100) : null,
      redemption_date: data.type === 'bond' && data.redemptionDate ? data.redemptionDate.toISOString() : null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      _sync_status: 'pending',
      _sync_error: null,
      _local_updated_at: Date.now(),
    }

    await db.investments.add(investment)

    // Перша партія (лот) облігації — сама покупка, введена в цій формі.
    // Наступні докупівлі додають свої лоти через bond-lots-repo.ts, а
    // investment.quantity лишається похідним (сумою активних лотів).
    if (data.type === 'bond') {
      await bondLotsRepo.add(userId, investment.id, {
        date: investment.purchase_date,
        quantity: investment.quantity,
        price: investment.purchase_price,
      })
    }

    return investment
  },

  async update(id: string, data: InvestmentFormData): Promise<void> {
    const currentPrice = data.type === 'bond' ? data.purchasePrice : data.currentPrice
    await db.investments.update(id, {
      name: data.name,
      type: data.type,
      quantity: data.quantity,
      purchase_price: Math.round(data.purchasePrice * 100),
      current_price: Math.round(currentPrice * 100),
      currency: data.currency,
      purchase_date: data.purchaseDate.toISOString(),
      notes: data.notes?.trim() || null,
      interest_rate_percent: data.type === 'deposit' ? data.interestRatePercent ?? null : null,
      term_months: data.type === 'deposit' ? data.termMonths ?? null : null,
      coupon_amount: data.type === 'bond' && data.couponAmount != null ? Math.round(data.couponAmount * 100) : null,
      redemption_amount: data.type === 'bond' && data.redemptionAmount != null ? Math.round(data.redemptionAmount * 100) : null,
      redemption_date: data.type === 'bond' && data.redemptionDate ? data.redemptionDate.toISOString() : null,
      updated_at: new Date().toISOString(),
      _sync_status: 'pending',
      _local_updated_at: Date.now(),
    })
  },

  // Швидке оновлення тільки поточної ціни (без відкриття повної форми)
  async updateCurrentPrice(id: string, currentPriceUnits: number): Promise<void> {
    await db.investments.update(id, {
      current_price: Math.round(currentPriceUnits * 100),
      updated_at: new Date().toISOString(),
      _sync_status: 'pending',
      _local_updated_at: Date.now(),
    })
  },

  // Soft delete — як і транзакції, щоб інші пристрої дізнались про видалення
  async softDelete(id: string): Promise<void> {
    await db.investments.update(id, {
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _sync_status: 'pending',
      _local_updated_at: Date.now(),
    })
  },

  // Масове збереження (використовується при синхронізації)
  async upsertMany(investments: LocalInvestment[]): Promise<void> {
    await db.investments.bulkPut(investments)
  },
}
