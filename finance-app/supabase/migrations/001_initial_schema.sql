-- ============================================================
-- Міграція 001: Початкова схема бази даних
-- Запусти цей SQL у Supabase Dashboard → SQL Editor
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- Допоміжна функція: автоматично оновлює updated_at
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────────────
-- Таблиця: accounts (рахунки / гаманці)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.accounts (
  id          UUID        PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  currency    TEXT        NOT NULL DEFAULT 'UAH',
  is_archived BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user ON public.accounts(user_id);

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ──────────────────────────────────────────────────────────
-- Таблиця: categories (категорії витрат і доходів)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categories (
  id          UUID        PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('expense', 'income')),
  icon_name   TEXT        NOT NULL,
  color_hex   TEXT        NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_archived BOOLEAN     NOT NULL DEFAULT FALSE,
  -- is_system = TRUE означає системну (не видаляти)
  is_system   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_user_type ON public.categories(user_id, type);

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ──────────────────────────────────────────────────────────
-- Таблиця: transactions (транзакції)
-- ВАЖЛИВО: amount зберігається у КОПІЙКАХ (ціле число!)
-- Ніколи не зберігаємо суму як float — це втрата точності.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id          UUID        PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id  UUID        NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  category_id UUID        NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  type        TEXT        NOT NULL CHECK (type IN ('expense', 'income')),
  amount      BIGINT      NOT NULL CHECK (amount > 0),
  currency    TEXT        NOT NULL DEFAULT 'UAH',
  date        TIMESTAMPTZ NOT NULL,
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Soft delete: не видаляємо реально, щоб інші пристрої дізнались про видалення
  deleted_at  TIMESTAMPTZ
);

-- Індекси для швидкого пошуку по даті та фільтрації видалених
CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_deleted
  ON public.transactions(user_id, deleted_at)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_account
  ON public.transactions(account_id);

CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ──────────────────────────────────────────────────────────
-- Таблиця: tags
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tags (
  id      UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name    TEXT NOT NULL,
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tags_user ON public.tags(user_id);

-- ──────────────────────────────────────────────────────────
-- Таблиця: transaction_tags (зв'язок транзакція ↔ тег)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transaction_tags (
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  tag_id         UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);

-- ──────────────────────────────────────────────────────────
-- Row Level Security (RLS) — КРИТИЧНО для безпеки!
-- Без RLS будь-який авторизований користувач міг би
-- читати ЧУЖІ транзакції через Supabase API.
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_tags ENABLE ROW LEVEL SECURITY;

-- Принцип: кожен бачить тільки свої дані (auth.uid() = user_id)
CREATE POLICY "accounts_own_data" ON public.accounts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "categories_own_data" ON public.categories
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions_own_data" ON public.transactions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tags_own_data" ON public.tags
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- transaction_tags перевіряємо через власність транзакції
CREATE POLICY "transaction_tags_own_data" ON public.transaction_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_id AND t.user_id = auth.uid()
    )
  );
