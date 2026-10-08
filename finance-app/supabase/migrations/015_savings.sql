-- ============================================================
-- Міграція 015: Збереження (готівкові заощадження ГРН/USD/EUR)
-- Запусти цей SQL у Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.savings (
  id          UUID        PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  amount_uah  BIGINT      NOT NULL DEFAULT 0,
  amount_usd  BIGINT      NOT NULL DEFAULT 0,
  amount_eur  BIGINT      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Soft delete — як і recurring_payments, щоб інші пристрої дізнались про видалення
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_savings_user
  ON public.savings(user_id);

DROP TRIGGER IF EXISTS trg_savings_updated_at ON public.savings;
CREATE TRIGGER trg_savings_updated_at
  BEFORE UPDATE ON public.savings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.savings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "savings_own_data" ON public.savings;
CREATE POLICY "savings_own_data" ON public.savings
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
