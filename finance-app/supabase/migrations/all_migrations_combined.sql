-- ==================== 001_initial_schema.sql ====================
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

DROP TRIGGER IF EXISTS trg_accounts_updated_at ON public.accounts;
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

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
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

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON public.transactions;
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
DROP POLICY IF EXISTS "accounts_own_data" ON public.accounts;
CREATE POLICY "accounts_own_data" ON public.accounts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "categories_own_data" ON public.categories;
CREATE POLICY "categories_own_data" ON public.categories
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_own_data" ON public.transactions;
CREATE POLICY "transactions_own_data" ON public.transactions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tags_own_data" ON public.tags;
CREATE POLICY "tags_own_data" ON public.tags
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- transaction_tags перевіряємо через власність транзакції
DROP POLICY IF EXISTS "transaction_tags_own_data" ON public.transaction_tags;
CREATE POLICY "transaction_tags_own_data" ON public.transaction_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_id AND t.user_id = auth.uid()
    )
  );

-- ==================== 002_investments.sql ====================
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

DROP TRIGGER IF EXISTS trg_investments_updated_at ON public.investments;
CREATE TRIGGER trg_investments_updated_at
  BEFORE UPDATE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ──────────────────────────────────────────────────────────
-- Row Level Security — той самий принцип, що і в 001
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investments_own_data" ON public.investments;
CREATE POLICY "investments_own_data" ON public.investments
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==================== 003_deposit_contributions.sql ====================
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

DROP TRIGGER IF EXISTS trg_deposit_contributions_updated_at ON public.deposit_contributions;
CREATE TRIGGER trg_deposit_contributions_updated_at
  BEFORE UPDATE ON public.deposit_contributions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.deposit_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deposit_contributions_own_data" ON public.deposit_contributions;
CREATE POLICY "deposit_contributions_own_data" ON public.deposit_contributions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==================== 004_bond_coupon_dates.sql ====================
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

DROP TRIGGER IF EXISTS trg_bond_coupon_dates_updated_at ON public.bond_coupon_dates;
CREATE TRIGGER trg_bond_coupon_dates_updated_at
  BEFORE UPDATE ON public.bond_coupon_dates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.bond_coupon_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bond_coupon_dates_own_data" ON public.bond_coupon_dates;
CREATE POLICY "bond_coupon_dates_own_data" ON public.bond_coupon_dates
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==================== 005_bond_redemption_amount.sql ====================
-- ============================================================
-- Міграція 005: Облігації — окрема сума погашення (номінал)
-- Запусти цей SQL у Supabase Dashboard → SQL Editor
-- ============================================================

-- Сума купівлі (purchase_price × quantity) і сума погашення часто
-- відрізняються — облігація могла бути куплена з премією/дисконтом
-- до номіналу. Тільки для type='bond', для решти типів завжди NULL.
ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS redemption_amount BIGINT;

-- ==================== 006_bond_redemption_date.sql ====================
-- ============================================================
-- Міграція 006: Облігації — явна дата погашення
-- Запусти цей SQL у Supabase Dashboard → SQL Editor
-- ============================================================

-- Дата погашення вказується вручну (не виводиться з дат виплат купонів
-- у bond_coupon_dates, бо вони можуть не збігатись). Тільки для
-- type='bond', для решти типів завжди NULL.
ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS redemption_date DATE;

-- ==================== 007_portfolio_snapshots.sql ====================
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

DROP TRIGGER IF EXISTS trg_portfolio_snapshots_updated_at ON public.portfolio_snapshots;
CREATE TRIGGER trg_portfolio_snapshots_updated_at
  BEFORE UPDATE ON public.portfolio_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portfolio_snapshots_own_data" ON public.portfolio_snapshots;
CREATE POLICY "portfolio_snapshots_own_data" ON public.portfolio_snapshots
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==================== 008_bond_lots.sql ====================
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

DROP TRIGGER IF EXISTS trg_bond_lots_updated_at ON public.bond_lots;
CREATE TRIGGER trg_bond_lots_updated_at
  BEFORE UPDATE ON public.bond_lots
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.bond_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bond_lots_own_data" ON public.bond_lots;
CREATE POLICY "bond_lots_own_data" ON public.bond_lots
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==================== 009_crypto.sql ====================
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

DROP TRIGGER IF EXISTS trg_crypto_exchange_credentials_updated_at ON public.crypto_exchange_credentials;
CREATE TRIGGER trg_crypto_exchange_credentials_updated_at
  BEFORE UPDATE ON public.crypto_exchange_credentials
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.crypto_exchange_credentials ENABLE ROW LEVEL SECURITY;

-- Клієнт (anon/authenticated) може бачити ЛИШЕ факт підключення (для UI:
-- "підключено"/"не підключено") — не сам ключ, той лежить у vault і
-- доступний лише service_role з Edge Function.
DROP POLICY IF EXISTS "crypto_exchange_credentials_own_data" ON public.crypto_exchange_credentials;
CREATE POLICY "crypto_exchange_credentials_own_data" ON public.crypto_exchange_credentials
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ==================== 012_crypto_credentials_hardening.sql ====================
-- ============================================================
-- Міграція 012: Звуження RLS на crypto_exchange_credentials + превʼю ключа
-- Запусти цей SQL у Supabase Dashboard → SQL Editor.
--
-- Проблема (знайдено ревʼю коду): політика 009_crypto.sql була
-- `FOR ALL USING (auth.uid() = user_id)`, тобто клієнт (authenticated-роль)
-- міг НАПРЯМУ через supabase-js .update()/.insert() підмінити
-- vault_key_id/vault_secret_id на довільний UUID. Edge Function
-- crypto-binance-sync (service_role) розшифровує секрет за цим UUID без
-- перевірки належності — підміна перетворює синк на "оракул" для
-- розшифровки будь-якого секрета в vault. Запис і видалення мають йти
-- ЛИШЕ через crypto-binance-keys (service_role, який RLS не бачить
-- взагалі) — клієнту лишаємо тільки SELECT власного рядка (для UI:
-- "підключено"/назва ключа/останні 4 символи).
-- ============================================================
DROP POLICY IF EXISTS "crypto_exchange_credentials_own_data" ON public.crypto_exchange_credentials;
DROP POLICY IF EXISTS "crypto_exchange_credentials_select_own" ON public.crypto_exchange_credentials;

CREATE POLICY "crypto_exchange_credentials_select_own" ON public.crypto_exchange_credentials
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE клієнту (anon/authenticated) свідомо НЕ дозволені —
-- ці операції йдуть тільки з Edge Function під service_role, яка обходить
-- RLS повністю і сама відповідає за належність секретів у vault.

-- ──────────────────────────────────────────────────────────
-- key_last4 — останні 4 символи API-ключа (НЕ секрет, лише для показу
-- в UI типу "•••• •••• •••• ab12", щоб користувач розрізняв ключі в
-- списку без розшифровки vault).
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.crypto_exchange_credentials
  ADD COLUMN IF NOT EXISTS key_last4 TEXT;
