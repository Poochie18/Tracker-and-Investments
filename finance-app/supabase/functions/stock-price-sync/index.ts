// Edge Function: поточні ціни акцій через Finnhub (https://finnhub.io).
// На відміну від crypto-binance-sync — ключ тут ОДИН спільний на весь
// застосунок (не в Vault, не прив'язаний до user_id), бо Finnhub API-ключ
// не дає доступу до жодних персональних даних користувача, лише до
// публічних котирувань. Зберігається як звичайний секрет Edge Function
// (Supabase Dashboard → Edge Functions → Secrets → FINNHUB_API_KEY),
// ніколи не потрапляє в браузер. verify_jwt=true (supabase/config.toml) —
// без валідного токена користувача функцію викликати не можна, це і є
// захист спільного ключа від чужого зловживання квотою.
import { withCors, jsonResponse } from '../_shared/cors.ts'
import { getUserIdFromRequest } from '../_shared/auth.ts'

const FINNHUB_BASE = 'https://finnhub.io/api/v1'

interface FinnhubQuote {
  c: number  // current price
  pc: number // previous close
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }))
  if (req.method !== 'POST') return jsonResponse({ error: 'Метод не підтримується' }, 405)

  try {
    // Лише перевіряємо, що це справжній залогінений користувач застосунку —
    // саму відповідь Finnhub не прив'язуємо до userId (котирування публічні).
    await getUserIdFromRequest(req)

    const apiKey = Deno.env.get('FINNHUB_API_KEY')
    if (!apiKey) throw new Error('FINNHUB_API_KEY не налаштовано на сервері')

    const body = (await req.json().catch(() => ({}))) as { symbols?: unknown }
    const symbols = Array.isArray(body.symbols)
      ? Array.from(new Set(body.symbols.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)))
      : []
    if (symbols.length === 0) return jsonResponse({ prices: [], errors: [] })

    // Finnhub free-план не має пакетного ендпоінта котирувань — тягнемо
    // кожен тікер окремим запитом, ізольовано (як і в crypto-binance-sync
    // з цінами Binance): якщо для одного тікера немає даних/ліміт вичерпано,
    // решта тікерів все одно повертається.
    const results = await Promise.allSettled(
      symbols.map(async (symbol) => {
        const res = await fetch(`${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`)
        if (!res.ok) throw new Error(`Finnhub повернуло помилку (${res.status}) для ${symbol}`)
        const data = (await res.json()) as FinnhubQuote
        // c === 0 — Finnhub так позначає "тікер не знайдено" (а не помилку HTTP)
        if (!data.c || data.c <= 0) throw new Error(`Немає котирування для ${symbol}`)
        return { symbol, price: data.c }
      })
    )

    const prices: { symbol: string; price: number }[] = []
    const errors: { symbol: string; message: string }[] = []
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') prices.push(r.value)
      else errors.push({ symbol: symbols[i], message: extractErrorMessage(r.reason) })
    })

    return jsonResponse({ prices, errors, fetchedAt: new Date().toISOString() })
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
