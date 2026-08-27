import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'

// Синк поточних цін акцій через Edge Function stock-price-sync (Finnhub,
// спільний ключ застосунку). На відміну від crypto-exchange-repo — тут
// НЕ створюються/видаляються рядки (акції завжди вводяться вручну), лише
// оновлюється current_price для вже існуючих активів з заповненим
// ticker_symbol. Без тікера (введений вручну без нього) — актив просто
// пропускається, current_price лишається як був.

export interface StockPriceSyncResult {
  synced: number
  failed: { symbol: string; message: string }[]
}

export const stockPriceRepo = {
  async syncPrices(userId: string): Promise<StockPriceSyncResult> {
    const stocks = await db.investments
      .where('user_id')
      .equals(userId)
      .filter((i) => i.type === 'stock' && i.deleted_at === null && !!i.ticker_symbol)
      .toArray()

    if (stocks.length === 0) return { synced: 0, failed: [] }

    const symbols = Array.from(new Set(stocks.map((s) => s.ticker_symbol!)))

    const { data, error } = await supabase.functions.invoke<{
      prices: { symbol: string; price: number }[]
      errors: { symbol: string; message: string }[]
    }>('stock-price-sync', { method: 'POST', body: { symbols } })
    if (error) throw error
    if (!data) return { synced: 0, failed: [] }

    const priceBySymbol = new Map(data.prices.map((p) => [p.symbol, p.price]))
    const now = new Date().toISOString()

    for (const stock of stocks) {
      const price = priceBySymbol.get(stock.ticker_symbol!)
      if (price == null) continue
      await db.investments.update(stock.id, {
        current_price: Math.round(price * 100),
        updated_at: now,
        _sync_status: 'pending',
        _local_updated_at: Date.now(),
      })
    }

    return { synced: data.prices.length, failed: data.errors }
  },
}
