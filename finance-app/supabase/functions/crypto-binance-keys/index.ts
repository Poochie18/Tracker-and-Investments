// Edge Function: зберігає / відкликає Binance API-ключ користувача.
// POST { apiKey, apiSecret } → зберігає (створює або перезаписує) ключ у Vault.
// DELETE → видаляє підключення (soft delete рядка + видалення секретів з vault).
//
// Ключ і секрет НІКОЛИ не потрапляють у звичайну таблицю — лише в
// vault.secrets (шифрування "з коробки" в Supabase), у власній таблиці
// crypto_exchange_credentials лежать тільки UUID-посилання.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { withCors, jsonResponse } from '../_shared/cors.ts'
import { getServiceRoleClient, getUserIdFromRequest } from '../_shared/auth.ts'

// admin.rpc(...) повертає не звичайний Promise, а власний "thenable"-білдер
// supabase-js (лише .then(), без .catch()/.finally()) — ".catch(() => {})"
// одразу падає з TypeError "...catch is not a function", і ця помилка
// летіла в catch(err) усієї функції як 500, ламаючи видалення ключа.
// Обгортаємо звичайним try/catch — тут це навмисно "best effort": якщо
// секрет у vault вже видалений/не існує, не хочемо валити весь запит.
async function safeVaultDelete(admin: SupabaseClient, secretId: string): Promise<void> {
  try {
    await admin.rpc('vault_delete_secret', { secret_id: secretId })
  } catch {
    // ігноруємо — див. коментар вище
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }))

  try {
    const userId = await getUserIdFromRequest(req)
    const admin = getServiceRoleClient()

    if (req.method === 'DELETE') {
      const { data: existing } = await admin
        .from('crypto_exchange_credentials')
        .select('id, vault_key_id, vault_secret_id')
        .eq('user_id', userId)
        .eq('exchange', 'binance')
        .is('deleted_at', null)
        .maybeSingle()

      if (existing) {
        await safeVaultDelete(admin, existing.vault_key_id)
        await safeVaultDelete(admin, existing.vault_secret_id)
        // Раніше помилку тут не перевіряли — якщо UPDATE з будь-якої причини
        // не проходив, функція все одно відповідала 200 {ok:true}, клієнт
        // думав що видалення пройшло, а рядок насправді лишався активним
        // (deleted_at не змінювався) — ключ "незнищенний" в UI.
        const { error: deleteErr } = await admin
          .from('crypto_exchange_credentials')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', existing.id)
        if (deleteErr) throw deleteErr
      }
      return jsonResponse({ ok: true })
    }

    if (req.method === 'POST') {
      const { apiKey, apiSecret, label } = (await req.json()) as {
        apiKey?: string
        apiSecret?: string
        label?: string
      }
      if (!apiKey?.trim() || !apiSecret?.trim()) {
        return jsonResponse({ error: 'apiKey і apiSecret обов’язкові' }, 400)
      }

      // Видаляємо старі секрети з vault — і той, що з активного підключення
      // (переприв'язка ключа), і будь-які СИРІТСЬКІ з уже soft-deleted рядків
      // (напр. з часів, коли .catch() на .rpc() падав і видалення секрета не
      // проходило — рядок credentials позначився видаленим, а секрет лишався
      // висіти в vault.secrets назавжди). Без .is('deleted_at', null) — беремо
      // ВСІ рядки цього user+exchange, не лише активний.
      const { data: allPrevious } = await admin
        .from('crypto_exchange_credentials')
        .select('vault_key_id, vault_secret_id')
        .eq('user_id', userId)
        .eq('exchange', 'binance')

      for (const prev of allPrevious ?? []) {
        await safeVaultDelete(admin, prev.vault_key_id)
        await safeVaultDelete(admin, prev.vault_secret_id)
      }

      // Унікальний суфікс — vault.secrets має UNIQUE(name), а фіксоване ім'я
      // на юзера (як було раніше) знову зіткнеться з тою самою помилкою
      // ("duplicate key value violates unique constraint"), якщо видалення
      // вище з будь-якої причини не встигне/не зможе прибрати старий запис
      // (напр. право на vault_delete_secret ще не встигло стати консистентним).
      const suffix = crypto.randomUUID()
      const { data: keySecretId, error: keyErr } = await admin.rpc('vault_create_secret', {
        secret: apiKey.trim(),
        secret_name: `binance_key_${userId}_${suffix}`,
      })
      if (keyErr) throw keyErr

      const { data: secretSecretId, error: secretErr } = await admin.rpc('vault_create_secret', {
        secret: apiSecret.trim(),
        secret_name: `binance_secret_${userId}_${suffix}`,
      })
      if (secretErr) throw secretErr

      // key_last4 — НЕ секрет, лише для показу в списку ключів у налаштуваннях
      // ("•••• ab12"), щоб користувач бачив, який ключ підключений, без
      // повторної розшифровки vault на клієнті.
      const trimmedKey = apiKey.trim()
      const keyLast4 = trimmedKey.slice(-4)

      const { error: upsertErr } = await admin
        .from('crypto_exchange_credentials')
        .upsert(
          {
            user_id: userId,
            exchange: 'binance',
            vault_key_id: keySecretId,
            vault_secret_id: secretSecretId,
            label: label?.trim() || 'Binance',
            key_last4: keyLast4,
            deleted_at: null,
          },
          { onConflict: 'user_id,exchange' }
        )
      if (upsertErr) throw upsertErr

      return jsonResponse({ ok: true })
    }

    return jsonResponse({ error: 'Метод не підтримується' }, 405)
  } catch (err) {
    const message = extractErrorMessage(err)
    const status = message.includes('токен') || message.includes('заголовка') ? 401 : 500
    return jsonResponse({ error: message }, status)
  }
})

// PostgrestError (з .rpc()/.from()) — звичайний об'єкт з message, не
// instanceof Error — тому err instanceof Error губило деталі помилки.
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) return String((err as { message: unknown }).message)
  return 'Невідома помилка'
}
