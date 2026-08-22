-- ============================================================
-- Міграція 002: Таблиця інвестицій (Фаза 7 — модуль інвестицій)
-- Запусти цей SQL у Supabase Dashboard → SQL Editor
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- Таблиця: investments (інвестиційні активи)
-- ВАЖЛИВО: purchase_price / current_price зберігаються у
-- КОПІЙКАХ (мінімальних одиницях валюти), як і transactions.amount.
-- quantity — дробове число (акції можуть бути дробовими, крипта тим паче).
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.investments (
  id             UUID        PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  type           TEXT        NOT NULL CHECK (type IN ('stock', 'crypto', 'bond', 'deposit', 'other')),
  quantity       NUMERIC     NOT NULL CHECK (quantity > 0),
  purchase_price BIGINT      NOT NULL CHECK (purchase_price >= 0),
  current_price  BIGINT      NOT NULL CHECK (current_price >= 0),
  currency       TEXT        NOT NULL DEFAULT 'UAH',
  purchase_date  TIMESTAMPTZ NOT NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Soft delete: не видаляємо реально, щоб інші пристрої дізнались про видалення
  deleted_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_investments_user_deleted
  ON public.investments(user_id, deleted_at)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_investments_updated_at
  BEFORE UPDATE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ──────────────────────────────────────────────────────────
-- Row Level Security — той самий принцип, що і в 001
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "investments_own_data" ON public.investments
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
