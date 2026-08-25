import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import type { LocalInvestment } from '@/lib/db/schema'

// Робота з підключенням до Binance — на відміну від решти репозиторіїв
// (investments-repo, bond-lots-repo), тут НЕМАЄ offline-first: ключі й
// синхронізація балансів вимагають мережі в будь-якому разі (виклик
// Edge Function), і самі ключі свідомо не кешуються локально в Dexie.
// `supabase.functions.invoke` сам додає Authorization з поточної сесії.

export interface BinanceBalance {
  symbol: string
  quantity: number
  priceUsd: number | null
}

export interface BinanceConnectionStatus {
  connected: boolean
  connectedAt: string | null
  label: string | null
  keyLast4: string | null
}

// Soft delete усіх монет, синхронізованих з Binance (source='binance_sync'),
// для цього користувача. Спільна логіка для: 1) відключення ключа
// (disconnectBinance нижче) і 2) "сирітського" прибирання — якщо ключ уже
// відключено (напр. видалили ДО того, як цей код тут з'явився), а старі
// синхронізовані монети лишились в Dexie/Supabase назавжди "заморожені".
// Повертає true, якщо щось справді видалили (щоб виклик знав, чи інвалідувати кеш).
async function removeSyncedCryptoInvestments(userId: string): Promise<boolean> {
  const now = new Date().toISOString()
  const syncedCrypto = await db.investments
    .where('user_id')
    .equals(userId)
    .filter((i) => i.type === 'crypto' && i.source === 'binance_sync' && i.deleted_at === null)
    .toArray()

  await Promise.all(
    syncedCrypto.map((i) =>
      db.investments.update(i.id, {
        deleted_at: now,
        updated_at: now,
        _sync_status: 'pending',
        _local_updated_at: Date.now(),
      })
    )
  )

  return syncedCrypto.length > 0
}

export const cryptoExchangeRepo = {
  // Чи є в користувача активне підключення до Binance. RLS дозволяє
  // клієнту лише SELECT власного рядка (див. міграцію 012) — vault_key_id/
  // vault_secret_id тут навіть не запитуємо, вони не потрібні на клієнті
  // і сам стовпець клієнту недоступний на запис.
  async getConnectionStatus(): Promise<BinanceConnectionStatus> {
    const { data, error } = await supabase
      .from('crypto_exchange_credentials')
      .select('created_at, label, key_last4')
      .eq('exchange', 'binance')
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw error
    return {
      connected: !!data,
      connectedAt: data?.created_at ?? null,
      label: data?.label ?? null,
      keyLast4: data?.key_last4 ?? null,
    }
  },

  async saveBinanceKeys(apiKey: string, apiSecret: string, label?: string): Promise<void> {
    const { error } = await supabase.functions.invoke('crypto-binance-keys', {
      method: 'POST',
      body: { apiKey, apiSecret, label },
    })
    if (error) throw error
  },

  // Відключає Binance І прибирає всі раніше синхронізовані монети з
  // портфеля (soft delete) — інакше після видалення ключа на вкладці
  // "Крипта" лишались би "заморожені" баланси, які більше ніхто не
  // оновлює, замість інформ-повідомлення "підключи Binance". Активи,
  // додані вручну (source='manual', до появи авто-синку), не чіпаємо.
  async disconnectBinance(userId: string): Promise<void> {
    const { error } = await supabase.functions.invoke('crypto-binance-keys', {
      method: 'DELETE',
    })
    if (error) throw error

    await removeSyncedCryptoInvestments(userId)
  },

  // "Сирітське" прибирання — на випадок, коли ключ уже НЕ підключений
  // (getConnectionStatus().connected === false), а синхронізовані монети
  // все ще лежать у портфелі (напр. відключили ключ до появи цього
  // прибирання в disconnectBinance вище, або якийсь інший edge-кейс).
  // Викликається з вкладки "Крипта" щоразу, коли статус підключення
  // резолвиться в "не підключено" — безпечно викликати повторно, якщо
  // нічого прибирати не лишилось — просто нічого не робить.
  cleanupOrphanedSyncedCrypto: removeSyncedCryptoInvestments,

  // Тягне поточні баланси з Binance і мержить у локальний Dexie: для
  // кожного symbol шукає існуючий рядок з тим самим ticker_symbol — і
  // binance_sync (оновлює quantity/current_price), і manual (адаптує його
  // під синк, замінюючи source на 'binance_sync' — інакше монета,
  // додана вручну ДО підключення Binance, дублювалась би при першому ж
  // синку). purchase_price при адаптації НЕ трогаємо — це собівартість,
  // яку або ввів користувач вручну, або (для новоствореного рядка)
  // початково = поточна ціна (стартовий PnL=0).
  async syncBinanceBalances(userId: string): Promise<{ synced: number }> {
    const { data, error } = await supabase.functions.invoke<{
      balances: BinanceBalance[]
      fetchedAt: string
    }>('crypto-binance-sync', { method: 'POST' })
    if (error) throw error
    if (!data) return { synced: 0 }

    const existingCrypto = await db.investments
      .where('user_id')
      .equals(userId)
      .filter((i) => i.type === 'crypto' && i.deleted_at === null)
      .toArray()
    const existingBySymbol = new Map(existingCrypto.map((i) => [i.ticker_symbol, i]))
    // Для прибирання "зниклих" монет — лише ті, що вже й раніше йшли з синку
    // (не чіпаємо ручні активи, які просто не збіглись з поточним балансом).
    const previouslySynced = existingCrypto.filter((i) => i.source === 'binance_sync')

    const now = new Date().toISOString()
    for (const balance of data.balances) {
      if (balance.priceUsd === null) continue // немає курсу — пропускаємо, не ламаємо підсумки
      // НЕ округлюємо до цілої копійки — меметокени (PEPE, SHIB, BONK...)
      // коштують частки копійки за 1 токен, округлення занулило б ціну.
      const priceKopiyky = balance.priceUsd * 100
      const found = existingBySymbol.get(balance.symbol)

      if (found) {
        await db.investments.update(found.id, {
          quantity: balance.quantity,
          current_price: priceKopiyky,
          source: 'binance_sync',
          updated_at: now,
          _sync_status: 'pending',
          _local_updated_at: Date.now(),
        })
      } else {
        const newInvestment: LocalInvestment = {
          id: uuidv4(),
          user_id: userId,
          name: balance.symbol,
          type: 'crypto',
          quantity: balance.quantity,
          purchase_price: priceKopiyky, // собівартість невідома — старт з поточної ціни, PnL=0
          current_price: priceKopiyky,
          currency: 'USD',
          purchase_date: now,
          notes: null,
          interest_rate_percent: null,
          term_months: null,
          coupon_amount: null,
          redemption_amount: null,
          redemption_date: null,
          ticker_symbol: balance.symbol,
          source: 'binance_sync',
          created_at: now,
          updated_at: now,
          deleted_at: null,
          _sync_status: 'pending',
          _sync_error: null,
          _local_updated_at: Date.now(),
        }
        await db.investments.add(newInvestment)
      }
    }

    // Монети, які раніше прийшли з синку, але зникли з поточного балансу
    // (продані, виведені, або — як LDBTC/LDETH зі старих тестів — злиті
    // сервером у базовий тікер) — прибираємо (soft delete), інакше вони
    // лишаються "мертвими" дублікатами назавжди.
    const currentSymbols = new Set(data.balances.filter((b) => b.priceUsd !== null).map((b) => b.symbol))
    for (const inv of previouslySynced) {
      if (inv.ticker_symbol && !currentSymbols.has(inv.ticker_symbol)) {
        await db.investments.update(inv.id, {
          deleted_at: now,
          updated_at: now,
          _sync_status: 'pending',
          _local_updated_at: Date.now(),
        })
      }
    }

    return { synced: currentSymbols.size }
  },
}
