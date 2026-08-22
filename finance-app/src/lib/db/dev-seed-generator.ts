import { v4 as uuidv4 } from 'uuid'
import { subDays } from 'date-fns'
import { db } from '@/lib/db'
import type { LocalCategory, LocalTransaction, TransactionType } from './schema'

// ============================================================
// Генератор тестових транзакцій для локальної розробки.
// Наповнює Dexie реалістичними даними за останні N днів —
// щоб було на чому дивитись графіки, списки, фільтри тощо.
//
// Викликається тільки вручну з UI (dev-only кнопка в Settings).
// НЕ використовується в production-коді.
// ============================================================

const DAYS_BACK = 90

// Орієнтовні діапазони сум (у гривнях) і "вага" (частота) на день для кожної
// категорії витрат. Вага — приблизна ймовірність появи транзакції в конкретний день.
const EXPENSE_PROFILES: Record<string, { min: number; max: number; weight: number }> = {
  'Продукти харчування': { min: 100, max: 800, weight: 0.7 },
  Кафе: { min: 50, max: 350, weight: 0.5 },
  Транспорт: { min: 20, max: 300, weight: 0.5 },
  "Здоров'я": { min: 150, max: 2000, weight: 0.1 },
  Дім: { min: 500, max: 3000, weight: 0.15 },
  Одяг: { min: 300, max: 2500, weight: 0.08 },
  Дозвілля: { min: 100, max: 800, weight: 0.3 },
  Тренування: { min: 300, max: 1200, weight: 0.15 },
  Освіта: { min: 200, max: 3000, weight: 0.05 },
  Подарунки: { min: 200, max: 1500, weight: 0.05 },
  Подорожі: { min: 1000, max: 8000, weight: 0.03 },
  Техніка: { min: 500, max: 15000, weight: 0.03 },
  'Хоз товари': { min: 100, max: 600, weight: 0.2 },
  "Сім'я": { min: 200, max: 2000, weight: 0.1 },
  Депозит: { min: 500, max: 5000, weight: 0.05 },
  Інше: { min: 50, max: 500, weight: 0.15 },
}

// Коментарі, які час від часу підставляємо для реалістичності
const EXPENSE_COMMENTS: Record<string, string[]> = {
  'Продукти харчування': ['АТБ', 'Сільпо', 'Novus', 'Ринок'],
  Кафе: ['Кава з собою', 'Обід з колегами', 'Піца'],
  Транспорт: ['Таксі', 'Заправка', 'Проїзний'],
  Дозвілля: ['Кіно', 'Концерт', 'Підписка Netflix'],
}

const INCOME_PROFILES: Record<string, { min: number; max: number }> = {
  'Заробітна плата': { min: 15000, max: 25000 },
  Подарунок: { min: 200, max: 3000 },
  Відсотки: { min: 50, max: 500 },
  'Оренда квартири': { min: 5000, max: 9000 },
  Інше: { min: 100, max: 2000 },
}

function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1))
}

function pickComment(categoryName: string): string | undefined {
  const options = EXPENSE_COMMENTS[categoryName]
  if (!options || Math.random() > 0.4) return undefined
  return options[randomInt(0, options.length - 1)]
}

function buildTransaction(
  userId: string,
  accountId: string,
  category: LocalCategory,
  type: TransactionType,
  amountUah: number,
  date: Date,
  comment?: string
): LocalTransaction {
  const now = new Date().toISOString()
  return {
    id: uuidv4(),
    user_id: userId,
    account_id: accountId,
    category_id: category.id,
    type,
    amount: Math.round(amountUah * 100), // копійки
    currency: 'UAH',
    date: date.toISOString(),
    comment: comment ?? null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    // pending — щоб при появі мережі ці записи самі підтягнулись на сервер
    _sync_status: 'pending',
    _sync_error: null,
    _local_updated_at: Date.now(),
  }
}

// Генерує й одразу зберігає тестові транзакції за останні DAYS_BACK днів.
// Повертає кількість створених записів.
export async function seedDevTestData(userId: string): Promise<number> {
  const account = (
    await db.accounts.where('user_id').equals(userId).filter((a) => !a.is_archived).toArray()
  )[0]
  if (!account) {
    throw new Error('Немає жодного рахунку — спочатку увійди в застосунок (first-login setup)')
  }

  const categories = await db.categories.where('user_id').equals(userId).toArray()
  const expenseCategories = categories.filter((c) => c.type === 'expense')
  const incomeCategories = categories.filter((c) => c.type === 'income')
  if (expenseCategories.length === 0 || incomeCategories.length === 0) {
    throw new Error('Немає категорій — спочатку увійди в застосунок (first-login setup)')
  }

  const transactions: LocalTransaction[] = []
  const today = new Date()

  for (let i = 0; i < DAYS_BACK; i++) {
    const date = subDays(today, i)

    // ── Витрати: для кожної категорії кидаємо "кубик" за її вагою ──
    for (const category of expenseCategories) {
      const profile = EXPENSE_PROFILES[category.name] ?? { min: 50, max: 500, weight: 0.1 }
      if (Math.random() > profile.weight) continue

      const amount = randomInt(profile.min, profile.max)
      transactions.push(
        buildTransaction(userId, account.id, category, 'expense', amount, date, pickComment(category.name))
      )
    }

    // ── Зарплата: раз на місяць, у перші 5 днів ──
    const dayOfMonth = date.getDate()
    if (dayOfMonth <= 5) {
      const salary = incomeCategories.find((c) => c.name === 'Заробітна плата')
      if (salary) {
        const profile = INCOME_PROFILES['Заробітна плата']
        transactions.push(
          buildTransaction(userId, account.id, salary, 'income', randomInt(profile.min, profile.max), date)
        )
      }
    }

    // ── Інші випадкові доходи (рідко) ──
    for (const category of incomeCategories) {
      if (category.name === 'Заробітна плата') continue
      const profile = INCOME_PROFILES[category.name]
      if (!profile) continue
      if (Math.random() > 0.04) continue

      transactions.push(
        buildTransaction(userId, account.id, category, 'income', randomInt(profile.min, profile.max), date)
      )
    }
  }

  await db.transactions.bulkAdd(transactions)
  return transactions.length
}

// Видаляє ВСІ транзакції користувача (для повторного тестування з чистого аркуша).
// Категорії й рахунок залишаються — генеруємо дані наново поверх них.
export async function clearAllTransactions(userId: string): Promise<number> {
  const ids = await db.transactions.where('user_id').equals(userId).primaryKeys()
  await db.transactions.bulkDelete(ids)
  return ids.length
}
