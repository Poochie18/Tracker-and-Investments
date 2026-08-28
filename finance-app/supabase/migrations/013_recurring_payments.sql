-- ============================================================
-- Міграція 013: Регулярні платежі + push-сповіщення
-- Запусти цей SQL у Supabase Dashboard → SQL Editor
--
-- Після виконання ще потрібно (вручну, поза SQL):
-- 1. Dashboard → Edge Functions → Secrets: додати VAPID_PRIVATE_KEY,
--    VAPID_PUBLIC_KEY, VAPID_SUBJECT (mailto:...) і CRON_SECRET
--    (довільний випадковий рядок — розрізняє pg_cron від user JWT).
-- 2. Замінити <PROJECT_REF> і <CRON_SECRET> нижче на реальні значення
--    перед виконанням блоку cron.schedule.
-- 3. supabase functions deploy recurring-payments-cron
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- Таблиця: recurring_payments (шаблони регулярних платежів)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recurring_payments (
  id                   UUID        PRIMARY KEY,
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 TEXT        NOT NULL,
  type                 TEXT        NOT NULL CHECK (type IN ('expense', 'income')),
  amount               BIGINT      NOT NULL CHECK (amount > 0),
  currency             TEXT        NOT NULL DEFAULT 'UAH',
  category_id          UUID        NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  account_id           UUID        NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  comment              TEXT,
  frequency            TEXT        NOT NULL CHECK (frequency IN ('once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  start_date           DATE        NOT NULL,
  start_time           TIME        NOT NULL DEFAULT '09:00',
  end_date             DATE,
  is_active            BOOLEAN     NOT NULL DEFAULT TRUE,
  last_generated_date  DATE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Soft delete — як і transactions, щоб інші пристрої дізнались про видалення
  deleted_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_recurring_payments_user
  ON public.recurring_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_payments_active
  ON public.recurring_payments(user_id, is_active)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_recurring_payments_updated_at
  BEFORE UPDATE ON public.recurring_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.recurring_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_payments_own_data" ON public.recurring_payments
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- Таблиця: push_subscriptions (реєстрація пристрою для Web Push)
-- Не Dexie-таблиця — просто список endpoint'ів, без offline-sync.
-- Читає її лише service_role (recurring-payments-cron), звідси немає
-- SELECT-політики для звичайних користувачів — лише свій INSERT/DELETE.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT        NOT NULL UNIQUE,
  p256dh      TEXT        NOT NULL,
  auth        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_delete_own" ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- pg_cron + pg_net — періодичний виклик Edge Function
-- recurring-payments-cron кожні 15 хв (генерація серверної сторони —
-- коли застосунок закритий — і push-сповіщення).
-- ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ВАЖЛИВО: заміни <PROJECT_REF> і <CRON_SECRET> на реальні значення
-- (той самий CRON_SECRET, що і в секретах Edge Function) перед запуском.
SELECT cron.schedule(
  'recurring-payments-tick',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/recurring-payments-cron',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);
