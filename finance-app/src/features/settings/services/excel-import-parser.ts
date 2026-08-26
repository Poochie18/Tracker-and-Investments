// Немає кореневого "." експорту в package.json — треба явно вказувати
// build-таргет; застосунок працює в браузері, тож /browser.
import { readSheet, parseSheetData } from 'read-excel-file/browser'

// ============================================================
// Парсер .xlsx-експорту з іншого застосунку обліку фінансів.
// Формат (перевірено на реальних файлах): 3 листи — "Витрати",
// "Дохід", "Перекази". У кожному листі перший рядок — злитий
// заголовок листа ("список витрати" тощо), другий рядок —
// назви колонок, далі дані.
//
// "Перекази" (переказ між рахунками) — типу транзакції "переказ"
// у застосунку немає, такі рядки просто рахуємо і пропускаємо.
// ============================================================

export interface ParsedRow {
  date: Date
  category: string
  amount: number // у гривнях (не копійках) — конвертація в копійки на етапі імпорту
  comment: string | null
}

export interface ParsedExcelFile {
  expenses: ParsedRow[]
  incomes: ParsedRow[]
  skippedTransfers: number
}

interface RawParsedRow {
  date: Date
  category: string
  accAmount: number | null
  opAmount: number | null
  comment: string | null
}

const ROW_SCHEMA = {
  date: { column: 'Дата і час', type: Date },
  category: { column: 'Категорія', type: String },
  // У прикладах "Сума операції у валюті операції" завжди порожня, а фактична
  // сума лежить у "Сума у валюті рахунку" — беремо перше непорожнє з двох,
  // щоб не залежати від того, яку саме колонку заповнив конкретний експорт.
  accAmount: { column: 'Сума у валюті рахунку', type: Number, required: false },
  opAmount: { column: 'Сума операції у валюті операції', type: Number, required: false },
  comment: { column: 'Коментувати', type: String, required: false },
} as const

async function parseTransactionSheet(file: File, sheetName: string): Promise<ParsedRow[]> {
  let raw: unknown[][]
  try {
    raw = await readSheet(file, sheetName)
  } catch {
    // Листа немає у файлі — вважаємо, що в ньому просто нема таких операцій
    return []
  }

  // Прибираємо перший ("титульний") рядок листа — інакше жоден рядок
  // не розпізнається схемою (перевірено емпірично на реальних файлах).
  const dataRows = raw.slice(1)
  if (dataRows.length === 0) return []

  // parseSheetData повертає discriminated union: або { objects, errors: undefined }
  // при повному успіху, або { objects: undefined, errors } якщо хоч один рядок
  // не пройшов схему (напр. відсутня обов'язкова дата/категорія) — не буває
  // "частково" — тому перевіряємо саме objects, а не errors.length.
  const result = parseSheetData<RawParsedRow>(dataRows as never, ROW_SCHEMA)

  if (!result.objects) {
    throw new Error(
      `Не вдалось розпізнати лист "${sheetName}" — перевірте, що це коректний експорт транзакцій`
    )
  }

  return result.objects
    .map((r: RawParsedRow) => {
      const amount = r.accAmount ?? r.opAmount
      if (amount === null) {
        throw new Error(`Лист "${sheetName}": у рядку з датою ${r.date.toISOString()} немає суми`)
      }
      return { date: r.date, category: r.category, amount, comment: r.comment || null }
    })
}

async function countTransferRows(file: File): Promise<number> {
  let raw: unknown[][]
  try {
    raw = await readSheet(file, 'Перекази')
  } catch {
    return 0
  }
  // Перший рядок — титул листа, другий — заголовки колонок, далі — дані
  return Math.max(0, raw.length - 2)
}

export async function parseExcelExport(file: File): Promise<ParsedExcelFile> {
  const [expenses, incomes, skippedTransfers] = await Promise.all([
    parseTransactionSheet(file, 'Витрати'),
    parseTransactionSheet(file, 'Дохід'),
    countTransferRows(file),
  ])

  if (expenses.length === 0 && incomes.length === 0 && skippedTransfers === 0) {
    throw new Error(
      'Не вдалось розпізнати файл — перевірте, що це експорт з листами "Витрати"/"Дохід"'
    )
  }

  return { expenses, incomes, skippedTransfers }
}
