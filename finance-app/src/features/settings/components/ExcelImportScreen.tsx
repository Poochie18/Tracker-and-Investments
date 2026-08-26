import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Upload, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useAccounts } from '@/hooks/use-accounts'
import { db } from '@/lib/db'
import { parseExcelExport, type ParsedExcelFile } from '../services/excel-import-parser'
import {
  findMissingCategories, createMissingCategories, importParsedTransactions, type CategoryGap,
} from '../services/excel-import-service'
import { transactionKeys } from '@/hooks/use-transactions'

type Status = { type: 'success' | 'error'; message: string } | null

// Об'єднує розпарсені файли (можна обрати кілька за раз) в один набір.
function mergeParsed(files: ParsedExcelFile[]): ParsedExcelFile {
  return {
    expenses: files.flatMap((f) => f.expenses),
    incomes: files.flatMap((f) => f.incomes),
    skippedTransfers: files.reduce((sum, f) => sum + f.skippedTransfers, 0),
  }
}

export function ExcelImportScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: accounts = [] } = useAccounts(userId)

  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<ParsedExcelFile | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined)
  const [missingCategories, setMissingCategories] = useState<CategoryGap[]>([])
  const [creatingCategories, setCreatingCategories] = useState(false)
  const [importing, setImporting] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  const accountId = selectedAccountId ?? accounts[0]?.id

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0 || !userId) return

    setParsing(true)
    setStatus(null)
    setParsed(null)
    setMissingCategories([])

    try {
      const results = await Promise.all(files.map(parseExcelExport))
      const merged = mergeParsed(results)
      setParsed(merged)

      const existingCategories = await db.categories.where('user_id').equals(userId).toArray()
      setMissingCategories(findMissingCategories(merged, existingCategories))
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Помилка при читанні файлу' })
    } finally {
      setParsing(false)
    }
  }

  const handleCreateMissingCategories = async () => {
    if (!userId) return
    setCreatingCategories(true)
    try {
      await createMissingCategories(userId, missingCategories)
      setMissingCategories([])
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
      void queryClient.invalidateQueries({ queryKey: ['categories-all', userId] })
    } catch {
      setStatus({ type: 'error', message: 'Не вдалось створити категорії' })
    } finally {
      setCreatingCategories(false)
    }
  }

  const handleImport = async () => {
    if (!userId || !parsed || !accountId) return
    setImporting(true)
    setStatus(null)
    try {
      const { created, skipped } = await importParsedTransactions(userId, accountId, parsed)
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all(userId) })
      void queryClient.invalidateQueries({ queryKey: ['account', userId] })
      setStatus({
        type: 'success',
        message:
          `Імпортовано ${created} транзакцій` +
          (skipped > 0 ? ` (пропущено ${skipped} — категорію не знайдено)` : ''),
      })
      setParsed(null)
    } catch {
      setStatus({ type: 'error', message: 'Помилка при імпорті' })
    } finally {
      setImporting(false)
    }
  }

  const canImport = !!parsed && !!accountId && missingCategories.length === 0 && !importing

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      {/* ── Шапка ─────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 pb-4"
        style={{
          backgroundColor: 'var(--color-bg-header)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        }}
      >
        <button onClick={() => navigate(-1)} className="p-1 -ml-1">
          <ArrowLeft size={22} style={{ color: 'var(--color-text-primary)' }} />
        </button>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Імпорт з Excel
        </h1>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Перенеси транзакції з експорту іншого застосунку обліку фінансів (.xlsx з листами
          "Витрати"/"Дохід"). Можна обрати одразу кілька файлів. Перекази між рахунками поки не
          підтримуються і будуть пропущені. Повторний імпорт того самого файлу створить дублікати.
        </p>

        {status && (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-2xl"
            style={{ backgroundColor: status.type === 'success' ? 'rgba(81,207,102,0.12)' : 'rgba(255,107,107,0.12)' }}
          >
            {status.type === 'success' ? (
              <CheckCircle2 size={16} style={{ color: 'var(--color-income)' }} />
            ) : (
              <AlertCircle size={16} style={{ color: 'var(--color-expense)' }} />
            )}
            <p className="text-sm" style={{ color: status.type === 'success' ? 'var(--color-income)' : 'var(--color-expense)' }}>
              {status.message}
            </p>
          </div>
        )}

        {/* ── Вибір файлу ───────────────────────────────────── */}
        <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ backgroundColor: 'var(--color-bg-card)' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={parsing || !userId}
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-60"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-text-primary)' }}
          >
            <Upload size={16} />
            {parsing ? 'Читаємо файл...' : 'Обрати файл(и) .xlsx'}
          </button>
        </div>

        {parsed && (
          <>
            {/* ── Зведення ────────────────────────────────────── */}
            <div className="rounded-2xl p-4 flex flex-col gap-1" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                Знайдено {parsed.expenses.length} витрат, {parsed.incomes.length} доходів
              </p>
              {parsed.skippedTransfers > 0 && (
                <p className="text-xs" style={{ color: 'var(--color-fab)' }}>
                  Пропущено {parsed.skippedTransfers} переказів між рахунками (не підтримуються)
                </p>
              )}
            </div>

            {/* ── Рахунок ─────────────────────────────────────── */}
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Рахунок для імпорту
              </p>
              <div className="flex gap-2 flex-wrap">
                {accounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setSelectedAccountId(acc.id)}
                    className="px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
                    style={{
                      backgroundColor: acc.id === accountId ? 'var(--color-accent)' : 'rgba(255,255,255,0.06)',
                      color: acc.id === accountId ? '#1B2A2A' : 'var(--color-text-secondary)',
                    }}
                  >
                    {acc.name}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Категорії, яких бракує ────────────────────────── */}
            {missingCategories.length > 0 && (
              <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Категорій не знайдено ({missingCategories.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {missingCategories.map((gap) => (
                    <span
                      key={`${gap.name}|${gap.type}`}
                      className="text-xs px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-text-secondary)' }}
                    >
                      {gap.name} · {gap.type === 'expense' ? 'витрата' : 'дохід'}
                    </span>
                  ))}
                </div>
                <button
                  onClick={handleCreateMissingCategories}
                  disabled={creatingCategories}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: 'var(--color-accent)', color: '#1B2A2A' }}
                >
                  <Sparkles size={16} />
                  {creatingCategories ? 'Створюємо...' : 'Створити всі відсутні'}
                </button>
              </div>
            )}

            {/* ── Імпорт ─────────────────────────────────────── */}
            <button
              onClick={handleImport}
              disabled={!canImport}
              className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-opacity disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-accent)', color: '#1B2A2A' }}
            >
              {importing ? 'Імпортуємо...' : 'Імпортувати'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
