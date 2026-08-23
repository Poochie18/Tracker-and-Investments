-- ============================================================
-- Міграція 004: Облігації — ціна купону + дати виплат/погашення
-- Запусти цей SQL у Supabase Dashboard → SQL Editor
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- investments: ціна купону (тільки для type='bond', для решти NULL).
-- Сума однакова для кожної купонної виплати цієї облігації — дати
-- виплат зберігаються окремою таблицею нижче.
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS coupon_amount BIGINT;

-- ──────────────────────────────────────────────────────────
-- Таблиця: bond_coupon_dates (дати виплат купонів + дата погашення)
-- Найпізніша дата в списку по investment_id — це дата погашення
-- (повернення номіналу), решта — дати виплати купона. Окремого поля
-- "тип" немає — визначається на клієнті за максимальною датою.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bond_coupon_dates (
  id             UUID        PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investment_id  UUID        NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  payment_date   DATE        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bond_coupon_dates_investment
  ON public.bond_coupon_dates(investment_id);

CREATE TRIGGER trg_bond_coupon_dates_updated_at
  BEFORE UPDATE ON public.bond_coupon_dates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.bond_coupon_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bond_coupon_dates_own_data" ON public.bond_coupon_dates
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
