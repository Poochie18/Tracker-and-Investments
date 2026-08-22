import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import { investmentsRepo } from '@/features/investments/repositories/investments-repo'
import type { LocalTransaction, InvestmentType } from './schema'

// ============================================================
// Одноразовий dev-імпортер реальних даних користувача з Excel.
// Excel → Python → JSON (public/dev-real-*.json) → цей модуль
// читає JSON фетчем і записує в Dexie, мапуючи категорії за назвою.
//
// Файли з реальними фінансовими даними НЕ комітяться (.gitignore).
// Викликається тільки вручну з UI (dev-only кнопка в Settings).
// ============================================================

interface RawTransaction {
  date: string
  category: string
  originalCategory: string
  amount: number  // у гривнях
  comment: string | null
}

interface RawInvestment {
  name: string
  type: InvestmentType
  quantity: number
  purchasePrice: number
  currentPrice: number
  currency: string
  purchaseDate: string
  notes: string
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Не вдалось завантажити ${path} (${res.status})`)
  return res.json() as Promise<T>
}

export async function importRealTransactions(userId: string): Promise<{ created: number; skipped: number }> {
  const account = (
    await db.accounts.where('user_id').equals(userId).filter((a) => !a.is_archived).toArray()
  )[0]
  if (!account) throw new Error('Немає рахунку — спочатку увійди в застосунок')

  const categories = await db.categories.where('user_id').equals(userId).toArray()
  const categoryByName = new Map(categories.map((c) => [`${c.name}|${c.type}`, c]))

  const { expenses, incomes } = await fetchJson<{ expenses: RawTransaction[]; incomes: RawTransaction[] }>(
    '/dev-real-transactions.json'
  )

  const typed: Array<RawTransaction & { type: 'expense' | 'income' }> = [
    ...expenses.map((r) => ({ ...r, type: 'expense' as const })),
    ...incomes.map((r) => ({ ...r, type: 'income' as const })),
  ]

  const now = new Date().toISOString()
  const transactions: LocalTransaction[] = []
  let skipped = 0

  for (const r of typed) {
    const category = categoryByName.get(`${r.category}|${r.type}`)
    if (!category) {
      skipped++
      continue
    }

    transactions.push({
      id: uuidv4(),
      user_id: userId,
      account_id: account.id,
      category_id: category.id,
      type: r.type,
      amount: Math.round(r.amount * 100),
      currency: 'UAH',
      date: new Date(r.date).toISOString(),
      comment: r.comment ?? null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      _sync_status: 'pending',
      _sync_error: null,
      _local_updated_at: Date.now(),
    })
  }

  await db.transactions.bulkAdd(transactions)
  return { created: transactions.length, skipped }
}

export async function importRealInvestments(userId: string): Promise<number> {
  const { investments } = await fetchJson<{ investments: RawInvestment[] }>('/dev-real-investments.json')

  for (const inv of investments) {
    await investmentsRepo.create(userId, {
      name: inv.name,
      type: inv.type,
      quantity: inv.quantity,
      purchasePrice: inv.purchasePrice,
      currentPrice: inv.currentPrice,
      currency: inv.currency,
      purchaseDate: new Date(inv.purchaseDate),
      notes: inv.notes,
    })
  }

  return investments.length
}
