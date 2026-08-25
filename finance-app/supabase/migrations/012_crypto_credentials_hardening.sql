-- ============================================================
-- Міграція 012: Звуження RLS на crypto_exchange_credentials + превʼю ключа
-- Запусти цей SQL у Supabase Dashboard → SQL Editor.
--
-- Проблема (знайдено ревʼю коду): політика 009_crypto.sql була
-- `FOR ALL USING (auth.uid() = user_id)`, тобто клієнт (authenticated-роль)
-- міг НАПРЯМУ через supabase-js .update()/.insert() підмінити
-- vault_key_id/vault_secret_id на довільний UUID. Edge Function
-- crypto-binance-sync (service_role) розшифровує секрет за цим UUID без
-- перевірки належності — підміна перетворює синк на "оракул" для
-- розшифровки будь-якого секрета в vault. Запис і видалення мають йти
-- ЛИШЕ через crypto-binance-keys (service_role, який RLS не бачить
-- взагалі) — клієнту лишаємо тільки SELECT власного рядка (для UI:
-- "підключено"/назва ключа/останні 4 символи).
-- ============================================================
DROP POLICY IF EXISTS "crypto_exchange_credentials_own_data" ON public.crypto_exchange_credentials;
DROP POLICY IF EXISTS "crypto_exchange_credentials_select_own" ON public.crypto_exchange_credentials;

CREATE POLICY "crypto_exchange_credentials_select_own" ON public.crypto_exchange_credentials
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE клієнту (anon/authenticated) свідомо НЕ дозволені —
-- ці операції йдуть тільки з Edge Function під service_role, яка обходить
-- RLS повністю і сама відповідає за належність секретів у vault.

-- ──────────────────────────────────────────────────────────
-- key_last4 — останні 4 символи API-ключа (НЕ секрет, лише для показу
-- в UI типу "•••• •••• •••• ab12", щоб користувач розрізняв ключі в
-- списку без розшифровки vault).
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.crypto_exchange_credentials
  ADD COLUMN IF NOT EXISTS key_last4 TEXT;
