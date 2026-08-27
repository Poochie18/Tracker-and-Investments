import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { transactionsRepo } from '@/features/transactions/repositories/transactions-repo'
import { categoriesRepo } from '@/features/transactions/repositories/categories-repo'
import { accountsRepo } from '@/features/transactions/repositories/accounts-repo'
import { Money } from '@/lib/utils/money'

// ============================================================
// Export транзакцій за обраний період — на відміну від
// backup-service (повний технічний бекап усіх таблиць для
// відновлення), тут — людський, "плаский" звіт по транзакціях:
// .xlsx для Excel/Google Sheets або .json для власного аналізу.
// ============================================================

export interface ExportRow {
  Дата: string
  Тип: string
  Категорія: string
  Рахунок: string
  Сума: number
  Валюта: string
  Коментар: string
}

async function buildExportRows(userId: string, from: Date, to: Date): Promise<ExportRow[]> {
  const [transactions, categories, accounts] = await Promise.all([
    transactionsRepo.getByFilter({ userId, dateFrom: from, dateTo: to }),
    categoriesRepo.getAll(userId),
    accountsRepo.getAll(userId),
  ])

  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const accountById = new Map(accounts.map((a) => [a.id, a]))

  // Хронологічно, старі першими — зручніше читати у звіті, ніж
  // "нові вгорі" (як у списку транзакцій в самому застосунку).
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))

  return sorted.map((t) => ({
    Дата: format(new Date(t.date), 'dd.MM.yyyy'),
    Тип: t.type === 'income' ? 'Дохід' : 'Витрата',
    Категорія: categoryById.get(t.category_id)?.name ?? '—',
    Рахунок: accountById.get(t.account_id)?.name ?? '—',
    Сума: Money.fromKopiyky(t.amount).toUah(),
    Валюта: t.currency,
    Коментар: t.comment ?? '',
  }))
}

function exportFilename(from: Date, to: Date, isAllTime: boolean, ext: string): string {
  const suffix = isAllTime
    ? 'весь-час'
    : `${format(from, 'yyyy-MM-dd')}_${format(to, 'yyyy-MM-dd')}`
  return `transactions_${suffix}.${ext}`
}

// ── Загальна логіка збереження файлу (Web Share API з фолбеком) ─

async function saveFile(content: string | ArrayBuffer, filename: string, mimeType: string): Promise<void> {
  const blob = new Blob([content], { type: mimeType })

  if (navigator.share && navigator.canShare?.({ files: [new File([blob], filename, { type: mimeType })] })) {
    const file = new File([blob], filename, { type: mimeType })
    await navigator.share({ files: [file], title: 'Експорт транзакцій' })
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── JSON ──────────────────────────────────────────────────

export async function downloadTransactionsJson(
  userId: string,
  from: Date,
  to: Date,
  isAllTime = false
): Promise<void> {
  const rows = await buildExportRows(userId, from, to)
  const json = JSON.stringify(rows, null, 2)
  await saveFile(json, exportFilename(from, to, isAllTime, 'json'), 'application/json')
}

// ── XLSX ──────────────────────────────────────────────────

export async function downloadTransactionsXlsx(
  userId: string,
  from: Date,
  to: Date,
  isAllTime = false
): Promise<void> {
  const rows = await buildExportRows(userId, from, to)
  const worksheet = XLSX.utils.json_to_sheet(rows)
  worksheet['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 8 }, { wch: 32 },
  ]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Транзакції')
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  await saveFile(
    buffer,
    exportFilename(from, to, isAllTime, 'xlsx'),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
}
