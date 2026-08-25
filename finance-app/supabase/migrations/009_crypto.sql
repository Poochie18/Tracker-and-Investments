-- ============================================================
-- Міграція 009: Крипта — тікер для курсу/синку, позначка джерела
-- (вручну / синхронізовано з біржі) і таблиця API-ключів бірж.
-- Запусти цей SQL у Supabase Dashboard → SQL Editor.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- investments: нові поля для крипти
-- ticker_symbol — тікер для біржового API (напр. "BTC"), null для
-- інших типів активу і для крипти без прив'язки до курсу.
-- source — 'manual' (введено вручну) чи 'binance_sync' (рядок створено/
-- оновлюється автосинхронізацією з біржі; quantity/current_price такого
-- рядка оновлює лише синк, purchase_price — тільки користувач вручну).
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS ticker_symbol TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'binance_sync'));

-- ──────────────────────────────────────────────────────────
-- Vault — для безпечного зберігання API-ключів бірж. Секрети лежать
-- у vault.secrets (розшифровка тільки через service_role, недоступна
-- anon/authenticated ролям), у своїй таблиці зберігаємо лише посилання
-- (UUID) на записи vault, не самі значення.
-- ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- ──────────────────────────────────────────────────────────
-- Таблиця: crypto_exchange_credentials (підключення до біржі користувача)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crypto_exchange_credentials (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exchange        TEXT        NOT NULL DEFAULT 'binance',
  vault_key_id    UUID        NOT NULL,
  vault_secret_id UUID        NOT NULL,
  label           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE (user_id, exchange)
);

CREATE TRIGGER trg_crypto_exchange_credentials_updated_at
  BEFORE UPDATE ON public.crypto_exchange_credentials
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.crypto_exchange_credentials ENABLE ROW LEVEL SECURITY;

-- Клієнт (anon/authenticated) може бачити ЛИШЕ факт підключення (для UI:
-- "підключено"/"не підключено") — не сам ключ, той лежить у vault і
-- доступний лише service_role з Edge Function.
CREATE POLICY "crypto_exchange_credentials_own_data" ON public.crypto_exchange_credentials
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
