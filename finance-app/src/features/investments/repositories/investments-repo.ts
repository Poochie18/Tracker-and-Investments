import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import type { InvestmentType, LocalInvestment } from '@/lib/db/schema'
import type { InvestmentFormData } from '../types'
import { bondLotsRepo } from './bond-lots-repo'

// Репозиторій для роботи з інвестиціями через Dexie (IndexedDB).
// Той самий патерн, що і transactions-repo / categories-repo:
// пишемо тільки локально, _sync_status='pending' підхоплює sync-engine.

// Ціна за 1 шт у "копійках" — округлення до цілої копійки коректне для
// акцій/облігацій/депозитів (там ціна завжди щонайменше кілька центів),
// але для крипти (PEPE, SHIB, BONK — частки копійки за 1 токен) округлення
// до цілого занулило б ціну повністю (0.000009 * 100 → округлюється до 0).
// Для крипти лишаємо дробову частину — фінальна сума (ціна × кількість)
// округлюється вже при показі підсумків (Money.fromKopiyky), не тут.
function toPriceMinorUnits(amount: number, type: InvestmentType): number {
  return type === 'crypto' ? amount * 100 : Math.round(amount * 100)
}

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
      purchase_price: toPriceMinorUnits(data.purchasePrice, data.type),
      current_price: toPriceMinorUnits(currentPrice, data.type),
      currency: data.currency,
      purchase_date: data.purchaseDate.toISOString(),
      notes: data.notes?.trim() || null,
      interest_rate_percent: data.type === 'deposit' ? data.interestRatePercent ?? null : null,
      term_months: data.type === 'deposit' ? data.termMonths ?? null : null,
      coupon_amount: data.type === 'bond' && data.couponAmount != null ? Math.round(data.couponAmount * 100) : null,
      redemption_amount: data.type === 'bond' && data.redemptionAmount != null ? Math.round(data.redemptionAmount * 100) : null,
      redemption_date: data.type === 'bond' && data.redemptionDate ? data.redemptionDate.toISOString() : null,
      ticker_symbol:
        (data.type === 'crypto' || data.type === 'stock') && data.tickerSymbol
          ? data.tickerSymbol.trim().toUpperCase()
          : null,
      source: 'manual',
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
      purchase_price: toPriceMinorUnits(data.purchasePrice, data.type),
      current_price: toPriceMinorUnits(currentPrice, data.type),
      currency: data.currency,
      purchase_date: data.purchaseDate.toISOString(),
      notes: data.notes?.trim() || null,
      interest_rate_percent: data.type === 'deposit' ? data.interestRatePercent ?? null : null,
      term_months: data.type === 'deposit' ? data.termMonths ?? null : null,
      coupon_amount: data.type === 'bond' && data.couponAmount != null ? Math.round(data.couponAmount * 100) : null,
      redemption_amount: data.type === 'bond' && data.redemptionAmount != null ? Math.round(data.redemptionAmount * 100) : null,
      redemption_date: data.type === 'bond' && data.redemptionDate ? data.redemptionDate.toISOString() : null,
      ticker_symbol:
        (data.type === 'crypto' || data.type === 'stock') && data.tickerSymbol
          ? data.tickerSymbol.trim().toUpperCase()
          : null,
      // source навмисно не чіпаємо тут — рядок, створений синком біржі
      // (source='binance_sync'), лишається таким і при ручному редагуванні
      // ціни купівлі через цю ж форму.
      updated_at: new Date().toISOString(),
      _sync_status: 'pending',
      _local_updated_at: Date.now(),
    })
  },

  // Швидке оновлення тільки поточної ціни (без відкриття повної форми)
  async updateCurrentPrice(id: string, currentPriceUnits: number): Promise<void> {
    const existing = await db.investments.get(id)
    await db.investments.update(id, {
      current_price: toPriceMinorUnits(currentPriceUnits, existing?.type ?? 'other'),
      updated_at: new Date().toISOString(),
      _sync_status: 'pending',
      _local_updated_at: Date.now(),
    })
  },

  // Пропорційно масштабує собівартість (purchase_price) УСІХ активів заданого
  // типу користувача так, щоб їх сумарне "Вкладено" стало newTotalUnits (у
  // "копійках" валюти портфеля). Для пенсіла біля АГРЕГОВАНОГО "Вкладено"
  // (Крипта, Акції) — саму суму редагувати напряму нема сенсу (вона похідна
  // від N рядків), тож розподіляємо зміну пропорційно: множимо purchase_price
  // кожного рядка на один коефіцієнт (invested_i = purchase_price_i ×
  // quantity_i, тож множення purchase_price_i на ratio масштабує invested_i
  // на той самий ratio незалежно від quantity).
  async scaleInvestedByType(userId: string, type: InvestmentType, newTotalUnits: number): Promise<void> {
    const items = await db.investments
      .where('user_id')
      .equals(userId)
      .filter((i) => i.type === type && i.deleted_at === null)
      .toArray()
    if (items.length === 0) return

    const now = new Date().toISOString()
    const oldTotal = items.reduce((sum, i) => sum + i.purchase_price * i.quantity, 0)

    if (oldTotal > 0) {
      const ratio = newTotalUnits / oldTotal
      await Promise.all(
        items.map((i) =>
          db.investments.update(i.id, {
            purchase_price: i.purchase_price * ratio,
            updated_at: now,
            _sync_status: 'pending',
            _local_updated_at: Date.now(),
          })
        )
      )
      return
    }

    // Нема з чого масштабувати (усі purchase_price = 0, напр. щойно
    // підключений синк) — розподіляємо пропорційно поточній вартості;
    // якщо й вона нульова — рівними частками між рядками.
    const totalCurrentValue = items.reduce((sum, i) => sum + i.current_price * i.quantity, 0)
    await Promise.all(
      items.map((i) => {
        const weight =
          totalCurrentValue > 0 ? (i.current_price * i.quantity) / totalCurrentValue : 1 / items.length
        const newPurchasePrice = i.quantity > 0 ? (newTotalUnits * weight) / i.quantity : 0
        return db.investments.update(i.id, {
          purchase_price: newPurchasePrice,
          updated_at: now,
          _sync_status: 'pending',
          _local_updated_at: Date.now(),
        })
      })
    )
  },

  // "Докупити" акцію — на відміну від облігацій (партії/лоти з датою кожної
  // покупки, bond-lots-repo.ts), для акцій ведемо простий "плаский" рахунок:
  // кількість підсумовується, а середня ціна купівлі — простим середнім
  // старої і нової ціни (не зваженим по кількості, за прямою вимогою:
  // "ціна додається до ціни купівлі яка вже була і ділиться навпіл").
  // Дата купівлі оновлюється на дату цієї (найостаннішої) докупівлі.
  async buyMoreStock(
    id: string,
    input: { date: string; quantity: number; price: number } // price — копійки за 1 шт
  ): Promise<void> {
    const existing = await db.investments.get(id)
    if (!existing) throw new Error('Актив не знайдено')

    await db.investments.update(id, {
      quantity: existing.quantity + input.quantity,
      purchase_price: Math.round((existing.purchase_price + input.price) / 2),
      purchase_date: new Date(input.date).toISOString(),
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
