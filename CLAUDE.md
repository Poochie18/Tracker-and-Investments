# CLAUDE.md

Інструкції для Claude Code в цьому репозиторії. Читай перед початком роботи.

## Що це за проєкт

**Finance App** — особистий PWA-трекер фінансів і інвестицій. Код живе в
підпапці **`finance-app/`** (не в корені репо!). React 19 + TypeScript +
Vite, офлайн-first: усі дані читаються/пишуться в локальну IndexedDB
(Dexie), і окремим шаром синхронізуються з Supabase (Postgres + Auth +
Realtime + Edge Functions). Розгортається на GitHub Pages
(`.github/workflows/deploy.yml`, тригер — push у `main`).

Користувач (власник репо) — початківець у сучасному фронтенді, спілкування
українською. UI-тексти й коментарі в коді — теж українською.

## Технології

- React 19, TypeScript, Vite 8, Tailwind CSS 4
- Dexie (IndexedDB) — локальна БД, `src/lib/db/`
- Supabase — хмарна БД (Postgres + RLS), auth (Google OAuth), Realtime,
  Edge Functions (`supabase/functions/`)
- TanStack Query — кеш/стан над Dexie (НЕ над мережею напряму — дивись
  нижче про `networkMode: 'always'`)
- Zustand — дрібний UI-стан (фільтри тощо)
- Recharts — графіки
- vite-plugin-pwa (`injectManifest`, власний `src/sw.ts`) — офлайн-кеш +
  push-нагадування про регулярні платежі

## Структура

```
finance-app/
  src/
    features/{auth,transactions,investments,settings}/
      components/     — екрани й UI-компоненти фічі
      repositories/    — Dexie-репозиторії (create/update/delete)
    hooks/             — React Query хуки над репозиторіями
    lib/
      db/              — Dexie-схема (schema.ts типи, index.ts версії)
      sync/             — sync-engine.ts (push/pull/realtime), sync-queue.ts
      settings/         — дрібні localStorage-налаштування (fiscal-year,
                            investment-visibility) — useSyncExternalStore
      supabase.ts
    components/         — спільні UI-компоненти (AppLayout, ErrorBoundary,
                            DeferredChart, SwipeNavigator, ...)
  supabase/
    migrations/          — SQL, застосовується вручну через SQL Editor
                            (немає supabase CLI/CI для міграцій!)
    functions/            — Edge Functions (Binance sync, cron тощо)
```

## Архітектура синку (Dexie ↔ Supabase) — читай ПЕРЕД тим, як додавати нову таблицю

Кожна синхронізована сутність існує у ЧОТИРЬОХ місцях одночасно — пропуск
будь-якого ламає синк мовчки (дані застрягають локально або губляться):

1. **`src/lib/db/schema.ts`** — інтерфейс хмарного типу (`Foo`) + локальний
   (`LocalFoo extends Foo` з `_sync_status/_sync_error/_local_updated_at`).
2. **`src/lib/db/index.ts`** — НОВА версія Dexie-схеми (`this.version(N+1).stores({...})`,
   копіюєш ВЕСЬ попередній `.stores()` об'єкт + додаєш новий рядок) + нова
   властивість `EntityTable<LocalFoo, 'id'>`.
3. **`src/lib/sync/sync-queue.ts`** — `pushTable<LocalFoo>(db.foo, 'foo', 'label', userId)`
   у `flushSyncQueue`, і рахунок pending/error у `hasPendingRecords`/`countSyncErrors`.
4. **`src/lib/sync/sync-engine.ts`** — `pullFoo()` (виклик з `pullAll()`),
   опційно realtime-підписка (`startRealtime()` + `handleFooChange`), і
   ключ у `invalidateQueries()`.

Плюс: репозиторій (`features/*/repositories/foo-repo.ts`, пише тільки в
Dexie з `_sync_status: 'pending'`), React Query хук (`hooks/use-foo.ts`,
мутації викликають `triggerSync()` з `useSyncContext()` після успіху), і
SQL-міграція (див. нижче).

## Supabase-міграції

**Немає CLI/автоматизації** — кожен файл у `supabase/migrations/*.sql`
власник виконує ВРУЧНУ в Supabase Dashboard → SQL Editor. Тому:

- Кожна міграція має бути **ідемпотентною** — `CREATE TABLE IF NOT EXISTS`,
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `DROP POLICY/TRIGGER IF EXISTS`
  перед `CREATE`. Файл мусить безпечно виконуватись повторно (перший
  прогін міг обірватись, або власник міг раніше виконати старіший чорновий
  варіант з іншою структурою — так і сталось із 014, звідки
  `PGRST204 Could not find the 'created_at' column`).
- Закінчуй міграцію, що змінює структуру таблиці, на
  `NOTIFY pgrst, 'reload schema';` — інакше кеш PostgREST API може кілька
  хвилин не бачити нові колонки.
- **Не забудь нагадати власнику виконати SQL** після коміту нової міграції
  — сам код (Dexie/репозиторій) без цього працюватиме тільки локально, а
  push у Supabase падатиме з помилкою схеми.

## Небезпечні патерни, у які легко вступити

- **`useSyncExternalStore` + `getSnapshot`, що повертає новий об'єкт/масив
  щовиклику** (напр. `new Set(...)`, `.filter()`, `[...arr]`) — ламає
  React (нескінченний цикл рендеру, "Maximum update depth exceeded",
  React error #185). `getSnapshot` МАЄ повертати стабільне посилання, поки
  дані реально не змінились — кешуй результат (див.
  `src/lib/settings/investment-visibility.ts` — кеш за сирим рядком
  localStorage). Оскільки такі хуки часто живуть в `AppLayout`
  (обгортка над усіма екранами), баг тут валить УВЕСЬ застосунок, не
  один екран.
- **Recharts `ResponsiveContainer`** вимірює контейнер синхронно на
  першому рендері — до коміту layout, іноді ловить width/height `-1`
  (нешкідливе, але шумне попередження в консолі). Оборачуй у
  `<DeferredChart>` (`src/components/DeferredChart.tsx`), батьківський
  контейнер тримай з фіксованою висотою, щоб не було "стрибка" розкладки.
- **Гроші — ЗАВЖДИ в мінімальних одиницях (копійки/центи), ціле число**
  (крім `purchase_price`/`current_price` крипти — там NUMERIC, дозволена
  дробова частина копійки, бо є монети дешевші за 0.01¢). Дивись
  `src/lib/utils/money.ts` (`Money.fromKopiyky`) і коментар у
  `investments-repo.ts::toPriceMinorUnits`.
- **`ErrorBoundary`** (`src/components/ErrorBoundary.tsx`) стоїть на двох
  рівнях — навколо `<App/>` в `main.tsx` і навколо кожного маршруту
  всередині `AppLayout` (`key={pathname}`, щоб краш одного екрана не
  валив застосунок назавжди). Не видаляй/не обходь без причини.

## Git-процес

- **Ніколи не комітити напряму в `main`.** Гілка → коміт → push гілки →
  `git merge --no-ff` у `main` → push `main` (це і тригерить деплой). Так
  навіть для дрібних фіксів — простіше тримати єдиний процес, ніж
  вирішувати щоразу.
- Коміт-меседжі — українською, з поясненням "чому", не тільки "що" (як і
  решта коментарів у коді).
- Перед комітом: `npx tsc -b`, `npx eslint <змінені файли>`, `npm run build`
  — усі три мають пройти чисто.
- **Обережно з git-археологією**: якщо `git log --all`/`git reflog`
  показують коміти, недосяжні з поточного `main` — це може бути раніше
  зроблена й потім відкочена робота (`git reset --hard`). Спитай власника,
  перш ніж або відновлювати (`git reset`/`cherry-pick`), або писати те
  саме заново — не вирішуй мовчки.

## Команди

Усе виконується з `finance-app/`, не з кореня репо:

```bash
npm run dev          # dev-сервер
npm run build         # tsc -b && vite build (+ postbuild копіює 404.html)
npm run lint           # eslint .
npm run test:run        # vitest run
```

## Дизайн-рішення, які виглядають дивно, але навмисні

- Крипта: "Ціна купівлі" по кожній монеті НЕ ведеться (форма її ховає) —
  агреговане "Вкладено (крипта)" це окреме ручне число
  (`user_investment_settings.crypto_manual_invested_usd_minor`), не сума
  по рядках. Так само "Вкладено (акції)" — ручне число, НЕ сумується з
  "Вільними коштами" (ті йдуть тільки в "Поточну вартість").
- "Огляд" інвестицій завжди в меню; решта вкладок (Депозити/Облігації/
  Крипта/Акції) можна ховати через Налаштування → "Вкладки інвестицій"
  (`src/lib/settings/investment-visibility.ts`, localStorage, НЕ
  синхронізується між пристроями — свідомо, як і "Початок фінансового
  року").
