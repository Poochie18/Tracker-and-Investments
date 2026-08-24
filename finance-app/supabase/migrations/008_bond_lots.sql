-- ============================================================
-- Міграція 008: Облігації — партії (лоти) купівлі
-- Запусти цей SQL у Supabase Dashboard → SQL Editor
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- Таблиця: bond_lots (кожна покупка облігації — окремим записом:
-- дата, кількість, ціна за штуку саме цієї партії). investments.quantity
-- лишається похідним значенням — сумою кількостей активних лотів,
-- яку клієнт підтримує в синхронному стані сам (bond-lots-repo.ts).
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bond_lots (
  id             UUID        PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investment_id  UUID        NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  purchase_date  DATE        NOT NULL,
  quantity       NUMERIC     NOT NULL,
  purchase_price BIGINT      NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bond_lots_investment
  ON public.bond_lots(investment_id);

CREATE TRIGGER trg_bond_lots_updated_at
  BEFORE UPDATE ON public.bond_lots
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.bond_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bond_lots_own_data" ON public.bond_lots
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
