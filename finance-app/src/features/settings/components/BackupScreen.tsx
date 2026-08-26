import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Upload, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { downloadBackup, importBackup, type ImportMode } from '../services/backup-service'
import { useQueryClient } from '@tanstack/react-query'

type Status = { type: 'success' | 'error'; message: string } | null

export function BackupScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [exporting, setExporting] = useState(false)
  const [importMode, setImportMode] = useState<ImportMode>('merge')
  const [importing, setImporting] = useState(false)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [pendingFile, setPendingFile] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>(null)

  const handleExport = async () => {
    if (!user) return
    setExporting(true)
    setStatus(null)
    try {
      await downloadBackup(user.id)
      setStatus({ type: 'success', message: 'Дані успішно експортовано' })
    } catch {
      setStatus({ type: 'error', message: 'Помилка при експорті' })
    } finally {
      setExporting(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const text = await file.text()

    if (importMode === 'replace') {
      setPendingFile(text)
      setConfirmReplace(true)
    } else {
      await runImport(text, 'merge')
    }
  }

  const runImport = async (jsonStr: string, mode: ImportMode) => {
    if (!user) return
    setImporting(true)
    setStatus(null)
    try {
      await importBackup(jsonStr, user.id, mode)
      // Інвалідуємо весь кеш — дані оновились
      await queryClient.invalidateQueries()
      setStatus({ type: 'success', message: 'Дані успішно імпортовано' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Невідома помилка'
      setStatus({ type: 'error', message: msg })
    } finally {
      setImporting(false)
      setConfirmReplace(false)
      setPendingFile(null)
    }
  }

  return (
    <div
      className="flex flex-col min-h-full"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
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
          Резервна копія
        </h1>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* ── Статус ────────────────────────────────────────── */}
        {status && (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-2xl"
            style={{
              backgroundColor:
                status.type === 'success' ? 'rgba(81,207,102,0.12)' : 'rgba(255,107,107,0.12)',
            }}
          >
            {status.type === 'success' ? (
              <CheckCircle2 size={16} style={{ color: 'var(--color-income)' }} />
            ) : (
              <AlertCircle size={16} style={{ color: 'var(--color-expense)' }} />
            )}
            <p
              className="text-sm"
              style={{
                color: status.type === 'success' ? 'var(--color-income)' : 'var(--color-expense)',
              }}
            >
              {status.message}
            </p>
          </div>
        )}

        {/* ── Експорт ───────────────────────────────────────── */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ backgroundColor: 'var(--color-bg-card)' }}
        >
          <div>
            <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
              Експортувати дані
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              Зберегти всі транзакції та категорії у файл JSON
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting || !user}
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-60"
            style={{ backgroundColor: 'var(--color-accent)', color: '#1B2A2A' }}
          >
            <Download size={16} />
            {exporting ? 'Експортуємо...' : 'Завантажити файл'}
          </button>
        </div>

        {/* ── Імпорт з Excel (з іншого застосунку) ───────────── */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ backgroundColor: 'var(--color-bg-card)' }}
        >
          <div>
            <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
              Імпорт з Excel
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              Перенести транзакції з експорту іншого застосунку обліку фінансів
            </p>
          </div>
          <button
            onClick={() => navigate('/settings/backup/import-excel')}
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-opacity"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-text-primary)' }}
          >
            <FileSpreadsheet size={16} />
            Обрати файл(и) .xlsx
          </button>
        </div>

        {/* ── Імпорт ────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ backgroundColor: 'var(--color-bg-card)' }}
        >
          <div>
            <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
              Імпортувати дані
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              Завантажити дані з файлу JSON
            </p>
          </div>

          {/* Режим імпорту */}
          <div className="flex gap-2">
            {(['merge', 'replace'] as ImportMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setImportMode(mode)}
                className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
                style={{
                  backgroundColor:
                    importMode === mode ? 'var(--color-accent)' : 'rgba(255,255,255,0.06)',
                  color: importMode === mode ? '#1B2A2A' : 'var(--color-text-secondary)',
                }}
              >
                {mode === 'merge' ? "Об'єднати" : 'Замінити'}
              </button>
            ))}
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {importMode === 'merge'
              ? "Додає імпортовані записи до поточних (дублікати за ID оновлюються)"
              : 'Видаляє всі поточні дані та замінює імпортованими'}
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing || !user}
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-60"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-text-primary)' }}
          >
            <Upload size={16} />
            {importing ? 'Імпортуємо...' : 'Вибрати файл'}
          </button>
        </div>
      </div>

      {/* ── Підтвердження заміни ──────────────────────────── */}
      {confirmReplace && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={() => {
              setConfirmReplace(false)
              setPendingFile(null)
            }}
          />
          <div
            className="relative w-full max-w-lg rounded-t-3xl p-6 pb-10 flex flex-col gap-4"
            style={{ backgroundColor: 'var(--color-bg-card)' }}
          >
            <p className="text-base font-semibold text-center" style={{ color: 'var(--color-text-primary)' }}>
              Замінити всі дані?
            </p>
            <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
              Всі поточні транзакції, категорії та рахунок будуть видалені та замінені даними з файлу. Цю дію неможливо скасувати.
            </p>
            <button
              onClick={() => pendingFile && runImport(pendingFile, 'replace')}
              className="w-full py-3 rounded-2xl font-semibold text-sm"
              style={{ backgroundColor: 'var(--color-expense)', color: '#fff' }}
            >
              Замінити
            </button>
            <button
              onClick={() => {
                setConfirmReplace(false)
                setPendingFile(null)
              }}
              className="w-full py-3 rounded-2xl font-semibold text-sm"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-text-primary)' }}
            >
              Скасувати
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
