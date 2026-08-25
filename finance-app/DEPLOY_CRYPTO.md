# Крипта/Binance — що зробити після заливки в main

Цей коміт додає автосинк криптовалют з Binance. Код у git — це лише половина;
Supabase (БД + Edge Functions) потрібно оновити **окремо й вручну**. Без цього
кроку застосунок збереться й запуститься, але вкладка "Крипта" не працюватиме
(або впаде з помилками на кшталт `invalid input syntax for type bigint`).

## 1. Міграції БД (Supabase Dashboard → SQL Editor)

Виконати **в цьому порядку**, кожну окремим запуском (кожна безпечна для
повторного запуску, якщо раптом виконаєш двічі):

1. `finance-app/supabase/migrations/009_crypto.sql` — таблиця
   `crypto_exchange_credentials`, поля `ticker_symbol`/`source` в `investments`.
2. `finance-app/supabase/migrations/010_vault_wrappers.sql` — SQL-обгортки
   для Supabase Vault (`vault_create_secret`/`vault_delete_secret`/`vault_read_secret`).
3. `finance-app/supabase/migrations/011_crypto_price_precision.sql` —
   `purchase_price`/`current_price` з `BIGINT` на `NUMERIC` (без цього кроку
   дробові ціни меметокенів ламають синк).
4. `finance-app/supabase/migrations/012_crypto_credentials_hardening.sql` —
   звужує RLS на `crypto_exchange_credentials` до `SELECT`-only + додає
   колонку `key_last4`.

Альтернативно — весь вміст одним запуском:
`finance-app/supabase/migrations/all_migrations_combined.sql` (тримається
синхронізованим з окремими файлами вище; якщо колись розійдуться — довіряй
окремим файлам, `all_migrations_combined.sql` лише для зручності копіпасти).

**Як перевірити, що застосувалось:** у Table Editor має з'явитись таблиця
`crypto_exchange_credentials`; у `investments` — колонки `ticker_symbol`,
`source`; тип `purchase_price`/`current_price` — `numeric`, не `bigint`.

## 2. Edge Functions

```bash
cd finance-app
supabase login          # якщо ще не логінився
supabase link --project-ref wkjbafbaaoasuehohedf
supabase functions deploy crypto-binance-keys
supabase functions deploy crypto-binance-sync
```

`supabase/config.toml` уже в репо — деплой підхопить його сам
(`verify_jwt = true` для обох функцій, тобто без валідного Supabase-токена
користувача їх викликати не можна).

## 3. Env-змінні Edge Functions

Ці мають бути вже виставлені в Supabase (стандартні для будь-якого проєкту,
нічого нового налаштовувати не треба) — просто для довідки, що функції на
них покладаються:
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
Перевірити: Supabase Dashboard → Edge Functions → Secrets.

## 4. Що НЕ треба робити

- **Vault extension** (`CREATE EXTENSION IF NOT EXISTS supabase_vault`, у
  міграції 009) — на керованому Supabase Cloud вона зазвичай вже увімкнена;
  якщо міграція впаде саме на цьому рядку з правами доступу — просто
  прибери цей рядок і ввімкни Vault через Dashboard → Database → Extensions.
- **.env / .env.local** — нових переданих клієнту змінних не додавалось,
  міняти нічого не треба.

## 5. Після деплою — як перевірити руками

1. Застосунок → Налаштування → "API-ключі бірж" → додати Binance-ключ
   (лише права **Enable Reading**, без Trading/Withdraw).
2. Має одразу автоматично стартувати синк балансів (спінер "Тягнемо
   баланси...").
3. Вкладка "Крипта" → мають з'явитись монети; кнопка синку в шапці —
   RefreshCw-іконка, підтягує баланси повторно за запитом.
4. Якщо щось не так — спершу перевір Supabase Dashboard → Edge Functions →
   Logs (`crypto-binance-sync`/`crypto-binance-keys`) на конкретну помилку.

## 6. На майбутнє — наступні міграції

Наступна міграція повинна називатись `013_...sql` (номери йдуть по
зростанню, не перевикористовуй/не вставляй між існуючими). Не забудь додати
її вміст і в `all_migrations_combined.sql`, якщо хочеш тримати той файл
актуальним.
