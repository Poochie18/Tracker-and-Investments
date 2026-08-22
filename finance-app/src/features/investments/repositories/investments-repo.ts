import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import type { LocalInvestment } from '@/lib/db/schema'
import type { InvestmentFormData } from '../types'

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
    const investment: LocalInvestment = {
      id: uuidv4(),
      user_id: userId,
      name: data.name,
      type: data.type,
      quantity: data.quantity,
      purchase_price: Math.round(data.purchasePrice * 100),
      current_price: Math.round(data.currentPrice * 100),
      currency: data.currency,
      purchase_date: data.purchaseDate.toISOString(),
      notes: data.notes?.trim() || null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      _sync_status: 'pending',
      _sync_error: null,
      _local_updated_at: Date.now(),
    }

    await db.investments.add(investment)
    return investment
  },

  async update(id: string, data: InvestmentFormData): Promise<void> {
    await db.investments.update(id, {
      name: data.name,
      type: data.type,
      quantity: data.quantity,
      purchase_price: Math.round(data.purchasePrice * 100),
      current_price: Math.round(data.currentPrice * 100),
      currency: data.currency,
      purchase_date: data.purchaseDate.toISOString(),
      notes: data.notes?.trim() || null,
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
