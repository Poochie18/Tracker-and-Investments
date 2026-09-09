-- ============================================================
-- Міграція 014: user_investment_settings
-- Запусти цей SQL у Supabase Dashboard → SQL Editor
--
-- Один рядок на користувача — "Вільні кошти" (готівка на брокерському
-- рахунку) і ручне "Вкладено" на вкладках "Акції"/"Крипта". Раніше усі три
-- значення жили тільки в localStorage (free-cash.ts) або виводились із
-- purchase_price активів (scaleInvestedByType) — пристрій-специфічно чи
-- неявно, звідси скарги, що поле "збивається". Тепер — реальна таблиця
-- з RLS, синхронізується між пристроями так само, як інші дані.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_investment_settings (
  id                                UUID        PRIMARY KEY,
  user_id                           UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  free_cash_usd_minor              BIGINT      NOT NULL DEFAULT 0,
  stock_manual_invested_usd_minor  BIGINT      NOT NULL DEFAULT 0,
  crypto_manual_invested_usd_minor BIGINT      NOT NULL DEFAULT 0,
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_investment_settings ENABLE ROW LEVEL SECURITY;

-- DROP IF EXISTS перед CREATE — щоб увесь файл можна було безпечно
-- перезапустити (напр. якщо перший прогін обірвався на цьому кроці).
DROP POLICY IF EXISTS "Users manage own investment settings" ON public.user_investment_settings;
CREATE POLICY "Users manage own investment settings"
  ON public.user_investment_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_user_investment_settings_updated_at ON public.user_investment_settings;
CREATE TRIGGER trg_user_investment_settings_updated_at
  BEFORE UPDATE ON public.user_investment_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
