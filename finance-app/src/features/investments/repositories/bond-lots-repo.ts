import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import type { LocalBondLot } from '@/lib/db/schema'

// Репозиторій партій (лотів) купівлі облігації. На відміну від дат виплат
// купонів (bond-coupon-dates-repo.ts, весь список редагується разом),
// кожен лот — самостійний запис зі своєю датою/кількістю/ціною: додається,
// редагується і видаляється окремо. Після кожної зміни лота перераховуємо
// й пишемо investment.quantity (сума кількостей активних лотів) напряму
// в Dexie — так само, як цей файл сам напряму пише в db.bondCouponDates,
// не через investments-repo.

interface BondLotInput {
  date: string   // ISO 8601
  quantity: number
  price: number  // копійки, за 1 шт
}

export const bondLotsRepo = {
  async getForInvestment(investmentId: string): Promise<LocalBondLot[]> {
    return db.bondLots
      .where('investment_id')
      .equals(investmentId)
      .filter((l) => l.deleted_at === null)
      .sortBy('purchase_date')
  },

  // Всі лоти користувача одразу (по всіх облігаціях) — для зведень.
  async getAllForUser(userId: string): Promise<LocalBondLot[]> {
    return db.bondLots
      .where('user_id')
      .equals(userId)
      .filter((l) => l.deleted_at === null)
      .sortBy('purchase_date')
  },

  async add(userId: string, investmentId: string, input: BondLotInput): Promise<void> {
    const now = new Date().toISOString()
    const lot: LocalBondLot = {
      id: uuidv4(),
      user_id: userId,
      investment_id: investmentId,
      purchase_date: input.date,
      quantity: input.quantity,
      purchase_price: input.price,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      _sync_status: 'pending',
      _sync_error: null,
      _local_updated_at: Date.now(),
    }
    await db.bondLots.add(lot)
    await syncInvestmentQuantity(investmentId)
  },

  async update(lotId: string, input: BondLotInput): Promise<void> {
    const lot = await db.bondLots.get(lotId)
    if (!lot) return
    await db.bondLots.update(lotId, {
      purchase_date: input.date,
      quantity: input.quantity,
      purchase_price: input.price,
      updated_at: new Date().toISOString(),
      _sync_status: 'pending',
      _local_updated_at: Date.now(),
    })
    await syncInvestmentQuantity(lot.investment_id)
  },

  async softDelete(lotId: string): Promise<void> {
    const lot = await db.bondLots.get(lotId)
    if (!lot) return
    const now = new Date().toISOString()
    await db.bondLots.update(lotId, {
      deleted_at: now,
      updated_at: now,
      _sync_status: 'pending',
      _local_updated_at: Date.now(),
    })
    await syncInvestmentQuantity(lot.investment_id)
  },
}

// Перераховує суму кількостей активних лотів і пише в investment.quantity —
// щоб непов'язаний з облігаціями код (заголовок картки, портфельні зведення
// для інших типів активів) і надалі міг покладатись на єдине число.
async function syncInvestmentQuantity(investmentId: string): Promise<void> {
  const activeLots = await db.bondLots
    .where('investment_id')
    .equals(investmentId)
    .filter((l) => l.deleted_at === null)
    .toArray()
  const totalQuantity = activeLots.reduce((sum, l) => sum + l.quantity, 0)
  await db.investments.update(investmentId, {
    quantity: totalQuantity,
    updated_at: new Date().toISOString(),
    _sync_status: 'pending',
    _local_updated_at: Date.now(),
  })
}
