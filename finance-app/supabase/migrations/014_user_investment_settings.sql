-- ============================================================
-- Міграція 014: user_investment_settings
-- Запусти цей SQL у Supabase Dashboard → SQL Editor
--
-- Один рядок на користувача — "Вільні кошти" (готівка на брокерському
-- рахунку) і ручне "Вкладено" на вкладці "Акції". Раніше обидва значення
-- жили тільки в localStorage (див. free-cash.ts/stock-manual-invested.ts) —
-- пристрій-специфічно і без реального збереження в БД, звідси скарги, що
-- поле "збивається". Тепер — реальна таблиця з RLS, синхронізується між
-- пристроями так само, як інші дані.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_investment_settings (
  user_id                          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  free_cash_usd_minor              BIGINT      NOT NULL DEFAULT 0,
  stock_manual_invested_usd_minor  BIGINT      NOT NULL DEFAULT 0,
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_investment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own investment settings"
  ON public.user_investment_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_user_investment_settings_updated_at
  BEFORE UPDATE ON public.user_investment_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
