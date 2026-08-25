// Edge Function: підписаний запит до Binance /api/v3/account за поточними
// балансами користувача (read-only) + публічні ціни /api/v3/ticker/price.
// Секрет ключа ніколи не йде в браузер — розшифровується тут, всередині
// функції, через vault.decrypted_secrets (доступно лише service_role).
import { withCors, jsonResponse } from '../_shared/cors.ts'
import { getServiceRoleClient, getUserIdFromRequest } from '../_shared/auth.ts'

const BINANCE_BASE = 'https://api.binance.com'

interface BinanceBalance {
  asset: string
  free: string
  locked: string
}

interface FundingBalance {
  asset: string
  free: string
  locked: string
  freeze: string
  withdrawing: string
}

interface SimpleEarnPosition {
  asset: string
  totalAmount: string
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }))
  if (req.method !== 'POST') return jsonResponse({ error: 'Метод не підтримується' }, 405)

  try {
    const userId = await getUserIdFromRequest(req)
    const admin = getServiceRoleClient()

    const { data: cred, error: credErr } = await admin
      .from('crypto_exchange_credentials')
      .select('vault_key_id, vault_secret_id')
      .eq('user_id', userId)
      .eq('exchange', 'binance')
      .is('deleted_at', null)
      .maybeSingle()
    if (credErr) throw credErr
    if (!cred) return jsonResponse({ error: 'Binance не підключено' }, 400)

    const [{ data: apiKey, error: keyErr }, { data: apiSecret, error: secretErr }] = await Promise.all([
      admin.rpc('vault_read_secret', { secret_id: cred.vault_key_id }),
      admin.rpc('vault_read_secret', { secret_id: cred.vault_secret_id }),
    ])
    if (keyErr) throw keyErr
    if (secretErr) throw secretErr
    if (!apiKey || !apiSecret) throw new Error('Не вдалось розшифрувати ключі')

    // ── Підписані запити балансів — SPOT-гаманець + Funding-гаманець ──
    // /api/v3/account бачить лише Spot (LDxxx-рядки тут ігноруємо, див.
    // нижче). Funding-гаманець (окремий на Binance — P2P, картка,
    // стейкінг-переказний буфер) має свій ендпоінт і в /api/v3/account
    // не потрапляє, тому баланс виглядав "меншим", ніж загальна картина
    // в застосунку Binance.
    const signedRequest = async (path: string, method: 'GET' | 'POST' = 'GET', extraParams = '') => {
      const timestamp = Date.now()
      const query = `timestamp=${timestamp}&recvWindow=5000${extraParams}`
      const signature = await hmacSha256Hex(apiSecret, query)
      return fetch(`${BINANCE_BASE}${path}?${query}&signature=${signature}`, {
        method,
        headers: { 'X-MBX-APIKEY': apiKey },
      })
    }

    const accountRes = await signedRequest('/api/v3/account')
    if (!accountRes.ok) {
      const body = await accountRes.text()
      throw new Error(`Binance повернуло помилку (${accountRes.status}): ${body.slice(0, 200)}`)
    }
    const account = (await accountRes.json()) as { balances: BinanceBalance[] }

    // Funding-гаманець — окремий запит; якщо в ключа нема прав або гаманець
    // порожній/недоступний, просто пропускаємо його (не валимо весь синк).
    let fundingBalances: FundingBalance[] = []
    try {
      const fundingRes = await signedRequest('/sapi/v1/asset/get-funding-asset', 'POST')
      if (fundingRes.ok) fundingBalances = (await fundingRes.json()) as FundingBalance[]
    } catch {
      // ігноруємо — funding-гаманець не критичний для решти синку
    }

    // Simple Earn Flexible + Locked (гнучкі й термінові позиції накопичення).
    // ВИПРАВЛЕНО (перевірено напряму через Binance API, Postman): "LD"-рядки
    // в /api/v3/account НЕ є надійним відображенням поточного Earn-балансу —
    // на цьому акаунті LDUSDC мав зовсім іншу (застарілу/неправильну) суму,
    // ніж справжній залишок на Simple Earn. Тому LDxxx-рядки зі спот-балансу
    // ІГНОРУЄМО повністю (див. addQty нижче), а справжній Earn-баланс беремо
    // напряму з цих двох ендпоінтів і додаємо до звичайного спот-балансу
    // того самого активу (напр. "USDC" = спот USDC + Flexible/Locked USDC).
    const simpleEarnPositions: SimpleEarnPosition[] = []
    try {
      const flexibleRes = await signedRequest('/sapi/v1/simple-earn/flexible/position', 'GET', '&size=100')
      if (flexibleRes.ok) {
        const data = (await flexibleRes.json()) as { rows: SimpleEarnPosition[] }
        simpleEarnPositions.push(...(data.rows ?? []))
      }
    } catch {
      // ігноруємо — Simple Earn не критичний для решти синку
    }
    try {
      const lockedRes = await signedRequest('/sapi/v1/simple-earn/locked/position', 'GET', '&size=100')
      if (lockedRes.ok) {
        const data = (await lockedRes.json()) as { rows: SimpleEarnPosition[] }
        simpleEarnPositions.push(...(data.rows ?? []))
      }
    } catch {
      // ігноруємо — Simple Earn не критичний для решти синку
    }

    const quantityByAsset = new Map<string, number>()
    const addQty = (symbol: string, qty: number) => {
      if (qty <= 0) return
      quantityByAsset.set(symbol, (quantityByAsset.get(symbol) ?? 0) + qty)
    }
    // LDxxx-рядки зі спот-балансу свідомо пропускаємо (startsWith('LD')) —
    // справжній Earn-баланс тягнемо окремо вище, через дедиковані ендпоінти.
    for (const b of account.balances) {
      if (b.asset.startsWith('LD')) continue
      addQty(b.asset, parseFloat(b.free) + parseFloat(b.locked))
    }
    for (const f of fundingBalances) {
      addQty(f.asset, parseFloat(f.free) + parseFloat(f.locked) + parseFloat(f.freeze) + parseFloat(f.withdrawing))
    }
    for (const p of simpleEarnPositions) addQty(p.asset, parseFloat(p.totalAmount))

    const heldBalances = Array.from(quantityByAsset.entries()).map(([symbol, quantity]) => ({ symbol, quantity }))

    if (heldBalances.length === 0) {
      return jsonResponse({ balances: [], fetchedAt: new Date().toISOString() })
    }

    // ── Публічні ціни (без підпису) для кожної монети в USDT ────
    // Сама USDT/USD прирівнюється до 1 — так само й інші стейблкоіни-USD.
    // heldBalances тут уже містить лише реальні базові тікери (LDxxx-рядки
    // відкинуті вище) — priceSymbol окремо не потрібен.
    const STABLE_USD = new Set(['USDT', 'USDC', 'BUSD', 'FDUSD', 'USD'])

    const uniqueTickersToPrice = Array.from(
      new Set(heldBalances.map((b) => b.symbol).filter((s) => !STABLE_USD.has(s)))
    )

    // Кожен тікер — окремим запитом (а не один пакетний): якщо для якоїсь
    // дрібної/нової монети пари з USDT не існує, Binance відхиляє ВЕСЬ
    // пакетний запит одразу — впала б ціна навіть у BTC/ETH поруч. Окремі
    // запити ізолюють такі помилки одна від одної.
    const priceResults = await Promise.allSettled(
      uniqueTickersToPrice.map(async (ticker) => {
        const res = await fetch(`${BINANCE_BASE}/api/v3/ticker/price?symbol=${ticker}USDT`)
        if (!res.ok) throw new Error(`немає пари ${ticker}USDT`)
        const data = (await res.json()) as { price: string }
        return { ticker, price: parseFloat(data.price) }
      })
    )

    const prices: Record<string, number> = {}
    for (const result of priceResults) {
      if (result.status === 'fulfilled') prices[result.value.ticker] = result.value.price
      // rejected — просто немає курсу для цієї монети, priceUsd лишиться null,
      // решта активів не зачіпає (кожен запит ізольований).
    }

    const balances = heldBalances.map((b) => ({
      symbol: b.symbol,
      quantity: b.quantity,
      priceUsd: STABLE_USD.has(b.symbol) ? 1 : prices[b.symbol] ?? null,
    }))

    return jsonResponse({ balances, fetchedAt: new Date().toISOString() })
  } catch (err) {
    const message = extractErrorMessage(err)
    const status = message.includes('токен') || message.includes('заголовка') ? 401 : 500
    return jsonResponse({ error: message }, status)
  }
})

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) return String((err as { message: unknown }).message)
  return 'Невідома помилка'
}
