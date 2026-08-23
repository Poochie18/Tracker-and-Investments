-- ============================================================
-- Міграція 007: Зліпки портфеля по фінансових роках (історія)
-- Запусти цей SQL у Supabase Dashboard → SQL Editor
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- Таблиця: portfolio_snapshots
-- Один запис на (user_id, fiscal_year_key) — суми по типу вкладення
-- (rows) зафіксовані на дату зліпку, у гривневому базисі. pnl/% не
-- зберігаються — рахуються на клієнті з invested/currentValue.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
  id                UUID        PRIMARY KEY,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fiscal_year_key   TEXT        NOT NULL,
  fiscal_year_label TEXT        NOT NULL,
  snapshot_date     TIMESTAMPTZ NOT NULL,
  rates_usd         NUMERIC     NOT NULL,
  rates_eur         NUMERIC     NOT NULL,
  rows              JSONB       NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (user_id, fiscal_year_key)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user
  ON public.portfolio_snapshots(user_id, deleted_at)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_portfolio_snapshots_updated_at
  BEFORE UPDATE ON public.portfolio_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portfolio_snapshots_own_data" ON public.portfolio_snapshots
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
