import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Tag, Archive, LogOut, Info, Wrench, FlaskConical, Trash2, UploadCloud } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useQueryClient } from '@tanstack/react-query'
import { deduplicateCategories } from '@/lib/auth/first-login-setup'
import { syncDefaultCategories } from '@/lib/db/category-sync'
import { seedDevTestData, clearAllTransactions } from '@/lib/db/dev-seed-generator'
import { importRealTransactions, importRealInvestments } from '@/lib/db/dev-real-data-importer'
import { transactionKeys } from '@/hooks/use-transactions'
import { investmentKeys } from '@/hooks/use-investments'

export function SettingsScreen() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const queryClient = useQueryClient()
  const [signingOut, setSigningOut] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [dedupMsg, setDedupMsg] = useState<string | null>(null)
  const [deduping, setDeduping] = useState(false)
  const [syncingCats, setSyncingCats] = useState(false)
  const [syncCatsMsg, setSyncCatsMsg] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [seedMsg, setSeedMsg] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)

  const handleDedup = async () => {
    if (!user) return
    setDeduping(true)
    setDedupMsg(null)
    try {
      const removed = await deduplicateCategories(user.id)
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
      void queryClient.invalidateQueries({ queryKey: ['categories-all', user.id] })
      setDedupMsg(removed > 0 ? `Видалено ${removed} дублікатів` : 'Дублікатів не знайдено')
    } catch {
      setDedupMsg('Помилка при очищенні')
    } finally {
      setDeduping(false)
    }
  }

  const handleSyncCategories = async () => {
    if (!user) return
    setSyncingCats(true)
    setSyncCatsMsg(null)
    try {
      const { renamed, created } = await syncDefaultCategories(user.id)
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
      void queryClient.invalidateQueries({ queryKey: ['categories-all', user.id] })
      if (renamed === 0 && created === 0) {
        setSyncCatsMsg('Все вже актуально')
      } else {
        setSyncCatsMsg(`Додано ${created}, перейменовано ${renamed}`)
      }
    } catch {
      setSyncCatsMsg('Помилка синхронізації')
    } finally {
      setSyncingCats(false)
    }
  }

  const invalidateAllTransactionData = () => {
    if (!user) return
    void queryClient.invalidateQueries({ queryKey: transactionKeys.all(user.id) })
    void queryClient.invalidateQueries({ queryKey: ['account', user.id] })
  }

  const handleSeed = async () => {
    if (!user) return
    setSeeding(true)
    setSeedMsg(null)
    try {
      const count = await seedDevTestData(user.id)
      invalidateAllTransactionData()
      setSeedMsg(`Створено ${count} транзакцій за останні 90 днів`)
    } catch (err) {
      setSeedMsg(err instanceof Error ? err.message : 'Помилка генерації даних')
    } finally {
      setSeeding(false)
    }
  }

  const handleClearTransactions = async () => {
    if (!user) return
    setSeeding(true)
    setSeedMsg(null)
    try {
      const count = await clearAllTransactions(user.id)
      invalidateAllTransactionData()
      setSeedMsg(`Видалено ${count} транзакцій`)
    } catch (err) {
      setSeedMsg(err instanceof Error ? err.message : 'Помилка видалення')
    } finally {
      setSeeding(false)
    }
  }

  const handleImportRealTransactions = async () => {
    if (!user) return
    setImporting(true)
    setImportMsg(null)
    try {
      const { created, skipped } = await importRealTransactions(user.id)
      invalidateAllTransactionData()
      setImportMsg(
        `Імпортовано ${created} транзакцій` + (skipped > 0 ? ` (пропущено ${skipped} — категорію не знайдено)` : '')
      )
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : 'Помилка імпорту')
    } finally {
      setImporting(false)
    }
  }

  const handleImportRealInvestments = async () => {
    if (!user) return
    setImporting(true)
    setImportMsg(null)
    try {
      const count = await importRealInvestments(user.id)
      void queryClient.invalidateQueries({ queryKey: investmentKeys.all(user.id) })
      setImportMsg(`Імпортовано ${count} активів`)
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : 'Помилка імпорту')
    } finally {
      setImporting(false)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
      setShowConfirm(false)
    }
  }

  return (
    <div
      className="flex flex-col min-h-full"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
      {/* ── Шапка ─────────────────────────────────────────── */}
      <div
        className="px-4 pb-4"
        style={{
          backgroundColor: 'var(--color-bg-header)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        }}
      >
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Налаштування
        </h1>
      </div>

      <div className="flex flex-col gap-2 p-4">
        {/* ── Секція: дані ────────────────────────────────── */}
        <p className="text-xs font-medium px-1 mb-1" style={{ color: 'var(--color-text-secondary)' }}>
          Дані
        </p>

        <SettingsItem
          icon={<Tag size={18} />}
          label="Категорії"
          description="Керування списком категорій"
          onPress={() => navigate('/settings/categories')}
        />

        <SettingsItem
          icon={<Archive size={18} />}
          label="Резервна копія"
          description="Експорт та імпорт даних"
          onPress={() => navigate('/settings/backup')}
        />

        {/* ── Виправлення дублікатів ───────────────────────── */}
        <button
          type="button"
          onClick={handleDedup}
          disabled={deduping}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl w-full text-left transition-opacity active:opacity-70 disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-bg-card)' }}
        >
          <Wrench size={18} style={{ color: 'var(--color-text-secondary)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {deduping ? 'Очищення...' : 'Виправити дублікати категорій'}
            </p>
            {dedupMsg && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-accent)' }}>
                {dedupMsg}
              </p>
            )}
            {!dedupMsg && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                Видалити дублікати, що виникли при першому вході
              </p>
            )}
          </div>
        </button>

        {/* ── Синхронізація дефолтних категорій ────────────── */}
        <button
          type="button"
          onClick={handleSyncCategories}
          disabled={syncingCats}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl w-full text-left transition-opacity active:opacity-70 disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-bg-card)' }}
        >
          <Tag size={18} style={{ color: 'var(--color-text-secondary)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {syncingCats ? 'Синхронізуємо...' : 'Оновити категорії за замовчуванням'}
            </p>
            {syncCatsMsg ? (
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-accent)' }}>
                {syncCatsMsg}
              </p>
            ) : (
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                Додати нові й перейменувати застарілі категорії
              </p>
            )}
          </div>
        </button>

        {/* ── DEV: тестові дані (тільки в dev-збірці) ──────── */}
        {import.meta.env.DEV && (
          <>
            <p className="text-xs font-medium px-1 mt-4 mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              DEV: тестові дані
            </p>

            <button
              type="button"
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl w-full text-left transition-opacity active:opacity-70 disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-bg-card)' }}
            >
              <FlaskConical size={18} style={{ color: 'var(--color-text-secondary)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {seeding ? 'Генеруємо...' : 'Наповнити тестовими транзакціями'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                  ~90 днів реалістичних витрат і доходів
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={handleClearTransactions}
              disabled={seeding}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl w-full text-left transition-opacity active:opacity-70 disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-bg-card)' }}
            >
              <Trash2 size={18} style={{ color: 'var(--color-expense)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--color-expense)' }}>
                  Видалити всі транзакції
                </p>
              </div>
            </button>

            {seedMsg && (
              <p className="text-xs px-1" style={{ color: 'var(--color-accent)' }}>
                {seedMsg}
              </p>
            )}

            <button
              type="button"
              onClick={handleImportRealTransactions}
              disabled={importing}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl w-full text-left transition-opacity active:opacity-70 disabled:opacity-50 mt-1"
              style={{ backgroundColor: 'var(--color-bg-card)' }}
            >
              <UploadCloud size={18} style={{ color: 'var(--color-text-secondary)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {importing ? 'Імпортуємо...' : 'Імпортувати реальні витрати/доходи'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                  З Excel-файлу (public/dev-real-transactions.json)
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={handleImportRealInvestments}
              disabled={importing}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl w-full text-left transition-opacity active:opacity-70 disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-bg-card)' }}
            >
              <UploadCloud size={18} style={{ color: 'var(--color-text-secondary)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {importing ? 'Імпортуємо...' : 'Імпортувати реальні інвестиції'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                  З Excel-файлу (public/dev-real-investments.json)
                </p>
              </div>
            </button>

            {importMsg && (
              <p className="text-xs px-1" style={{ color: 'var(--color-accent)' }}>
                {importMsg}
              </p>
            )}
          </>
        )}

        {/* ── Секція: акаунт ──────────────────────────────── */}
        <p className="text-xs font-medium px-1 mt-4 mb-1" style={{ color: 'var(--color-text-secondary)' }}>
          Акаунт
        </p>

        <SettingsItem
          icon={<LogOut size={18} />}
          label="Вийти з акаунту"
          onPress={() => setShowConfirm(true)}
          danger
        />

        {/* ── Секція: про застосунок ───────────────────────── */}
        <p className="text-xs font-medium px-1 mt-4 mb-1" style={{ color: 'var(--color-text-secondary)' }}>
          Про застосунок
        </p>

        <div
          className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ backgroundColor: 'var(--color-bg-card)' }}
        >
          <Info size={18} style={{ color: 'var(--color-text-secondary)' }} />
          <div className="flex-1">
            <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Finance App</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              Версія 0.1.0
            </p>
          </div>
        </div>
      </div>

      {/* ── Діалог підтвердження виходу ───────────────────── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={() => setShowConfirm(false)}
          />
          <div
            className="relative w-full max-w-lg rounded-t-3xl p-6 pb-10 flex flex-col gap-4"
            style={{ backgroundColor: 'var(--color-bg-card)' }}
          >
            <p className="text-base font-semibold text-center" style={{ color: 'var(--color-text-primary)' }}>
              Вийти з акаунту?
            </p>
            <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
              Локальні дані залишаться на пристрої. При наступному вході вони синхронізуються знову.
            </p>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full py-3 rounded-2xl font-semibold text-sm transition-opacity disabled:opacity-60"
              style={{ backgroundColor: 'var(--color-expense)', color: '#fff' }}
            >
              {signingOut ? 'Виходимо...' : 'Вийти'}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
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

// ── Допоміжний компонент рядка меню ───────────────────────

interface SettingsItemProps {
  icon: React.ReactNode
  label: string
  description?: string
  onPress: () => void
  danger?: boolean
}

function SettingsItem({ icon, label, description, onPress, danger }: SettingsItemProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl w-full text-left transition-opacity active:opacity-70"
      style={{ backgroundColor: 'var(--color-bg-card)' }}
    >
      <span style={{ color: danger ? 'var(--color-expense)' : 'var(--color-text-secondary)' }}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium"
          style={{ color: danger ? 'var(--color-expense)' : 'var(--color-text-primary)' }}
        >
          {label}
        </p>
        {description && (
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-secondary)' }}>
            {description}
          </p>
        )}
      </div>
      {!danger && <ChevronRight size={16} style={{ color: 'var(--color-text-secondary)' }} />}
    </button>
  )
}
