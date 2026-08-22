-- ============================================================
-- Міграція 003: Калькулятор депозитів — ставка, строк, помісячні поповнення
-- Запусти цей SQL у Supabase Dashboard → SQL Editor
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- investments: додаємо поля ставки й строку (тільки для type='deposit',
-- для решти типів завжди NULL)
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS interest_rate_percent NUMERIC,
  ADD COLUMN IF NOT EXISTS term_months INTEGER;

-- ──────────────────────────────────────────────────────────
-- Таблиця: deposit_contributions (помісячні поповнення депозиту)
-- Нарахування відсотків і залишок НЕ зберігаються тут — рахуються
-- на клієнті з interest_rate_percent + список поповнень.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deposit_contributions (
  id             UUID        PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investment_id  UUID        NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  month_index    INTEGER     NOT NULL CHECK (month_index >= 0),
  amount         BIGINT      NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ,
  UNIQUE (investment_id, month_index)
);

CREATE INDEX IF NOT EXISTS idx_deposit_contributions_investment
  ON public.deposit_contributions(investment_id);

CREATE TRIGGER trg_deposit_contributions_updated_at
  BEFORE UPDATE ON public.deposit_contributions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.deposit_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deposit_contributions_own_data" ON public.deposit_contributions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
