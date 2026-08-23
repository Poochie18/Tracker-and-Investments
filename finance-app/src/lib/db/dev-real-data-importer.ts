import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import { investmentsRepo } from '@/features/investments/repositories/investments-repo'
import { bondCouponDatesRepo } from '@/features/investments/repositories/bond-coupon-dates-repo'
import { portfolioSnapshotsRepo } from '@/features/investments/repositories/portfolio-snapshots-repo'
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

interface RawBondCouponDates {
  name: string             // має точно збігатись з name в dev-real-investments.json
  couponAmount: number     // сума купонної виплати ЗА 1 ШТ (у валюті активу), як ціна купівлі
  redemptionAmount: number // сума погашення ЗА 1 ШТ (у валюті активу), як ціна купівлі
  redemptionDate: string    // ISO 8601 (yyyy-mm-dd) — дата погашення
  dates: string[]           // ISO 8601 (yyyy-mm-dd) — дати виплат купонів
}

interface RawPortfolioSnapshot {
  fiscalYearKey: string
  fiscalYearLabel: string
  snapshotDate: string // ISO 8601 (yyyy-mm-dd)
  ratesUsd: number
  ratesEur: number
  rows: { type: InvestmentType; invested: number; currentValue: number }[] // у гривнях, не в копійках
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

// Дати виплат купонів + погашення облігацій — з листа "Облігації" Excel
// (таблиця "КАЛЕНДАР ВИПЛАТ"). Матчиться по investment.name з уже
// імпортованими облігаціями (importRealInvestments має відпрацювати першим).
export async function importRealBondCouponDates(userId: string): Promise<{ updated: number; notFound: string[] }> {
  const { bonds } = await fetchJson<{ bonds: RawBondCouponDates[] }>('/dev-real-bond-coupon-dates.json')

  const existingBonds = await db.investments
    .where('user_id')
    .equals(userId)
    .filter((i) => i.type === 'bond' && i.deleted_at === null)
    .toArray()
  const bondByName = new Map(existingBonds.map((b) => [b.name, b]))

  let updated = 0
  const notFound: string[] = []

  for (const raw of bonds) {
    const investment = bondByName.get(raw.name)
    if (!investment) {
      notFound.push(raw.name)
      continue
    }

    await db.investments.update(investment.id, {
      coupon_amount: Math.round(raw.couponAmount * 100),
      redemption_amount: Math.round(raw.redemptionAmount * 100),
      redemption_date: new Date(raw.redemptionDate).toISOString(),
      updated_at: new Date().toISOString(),
      _sync_status: 'pending',
      _local_updated_at: Date.now(),
    })
    await bondCouponDatesRepo.replaceAll(userId, investment.id, raw.dates)
    updated++
  }

  return { updated, notFound }
}

// Історичні зліпки портфеля — з листів "1 ГОД"/"2 ГОД" Excel-трекера
// (щорічні підсумки на кінець травня — фінансовий рік користувача
// починається в червні). Для тесту функціоналу історії на "Огляді".
export async function importRealPortfolioSnapshots(userId: string): Promise<number> {
  const { snapshots } = await fetchJson<{ snapshots: RawPortfolioSnapshot[] }>('/dev-real-portfolio-snapshots.json')

  for (const snap of snapshots) {
    await portfolioSnapshotsRepo.save(userId, {
      fiscalYearKey: snap.fiscalYearKey,
      fiscalYearLabel: snap.fiscalYearLabel,
      snapshotDate: new Date(snap.snapshotDate).toISOString(),
      ratesUsd: snap.ratesUsd,
      ratesEur: snap.ratesEur,
      rows: snap.rows.map((r) => ({
        type: r.type,
        invested: Math.round(r.invested * 100),
        currentValue: Math.round(r.currentValue * 100),
      })),
    })
  }

  return snapshots.length
}
