-- ============================================================
-- Міграція 014: user_investment_settings
-- Запусти цей SQL у Supabase Dashboard → SQL Editor
--
-- Один рядок на користувача — "Вільні кошти" (готівка на брокерському
-- рахунку) і ручне "Вкладено" на вкладках "Акції"/"Крипта". Раніше усі три
-- значення жили тільки в localStorage (free-cash.ts) або виводились із
-- purchase_price активів (scaleInvestedByType) — пристрій-специфічно чи
-- неявно, звідси скарги, що поле "збивається". Тепер — реальна таблиця
-- з RLS, синхронізується між пристроями так само, як інші дані.
--
-- Файл ідемпотентний і БЕЗПЕЧНО перезапускається повторно — навіть якщо
-- раніше вже виконувався попередній чорновий варіант цієї міграції з
-- іншою структурою (user_id як PRIMARY KEY, без окремого id/created_at —
-- звідси помилка "Could not find the 'created_at' column ... schema
-- cache"), нижні ALTER TABLE ADD COLUMN IF NOT EXISTS довизначать те,
-- чого бракує, замість падати на CREATE TABLE IF NOT EXISTS, яка нічого
-- не змінює в уже існуючій таблиці.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_investment_settings (
  id                                UUID        PRIMARY KEY,
  user_id                           UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  free_cash_usd_minor              BIGINT      NOT NULL DEFAULT 0,
  stock_manual_invested_usd_minor  BIGINT      NOT NULL DEFAULT 0,
  crypto_manual_invested_usd_minor BIGINT      NOT NULL DEFAULT 0,
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Довизначаємо колонки, якщо таблиця вже існувала в іншому вигляді
-- (старіший чорновий варіант без id/created_at, user_id як PK).
ALTER TABLE public.user_investment_settings ADD COLUMN IF NOT EXISTS id UUID;
UPDATE public.user_investment_settings SET id = user_id WHERE id IS NULL;
ALTER TABLE public.user_investment_settings ALTER COLUMN id SET NOT NULL;
-- Унікальний індекс на id (не обов'язково PRIMARY KEY constraint — досить
-- для on_conflict=id в upsert-запитах sync-queue.ts) — ідемпотентно, якщо
-- CREATE TABLE вище вже створив id як PRIMARY KEY, індекс під ним і так є.
CREATE UNIQUE INDEX IF NOT EXISTS user_investment_settings_id_key ON public.user_investment_settings (id);

ALTER TABLE public.user_investment_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.user_investment_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.user_investment_settings ENABLE ROW LEVEL SECURITY;

-- DROP IF EXISTS перед CREATE — щоб увесь файл можна було безпечно
-- перезапустити (напр. якщо перший прогін обірвався на цьому кроці).
DROP POLICY IF EXISTS "Users manage own investment settings" ON public.user_investment_settings;
CREATE POLICY "Users manage own investment settings"
  ON public.user_investment_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_user_investment_settings_updated_at ON public.user_investment_settings;
CREATE TRIGGER trg_user_investment_settings_updated_at
  BEFORE UPDATE ON public.user_investment_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Примушуємо PostgREST одразу перечитати схему — без цього кеш API іноді
-- ще кілька хвилин "не бачить" щойно додані/змінені колонки (PGRST204).
NOTIFY pgrst, 'reload schema';
