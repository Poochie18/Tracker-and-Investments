import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Loader2, WifiOff, AlertCircle, RefreshCw, CloudOff } from 'lucide-react'
import { useSyncContext } from '@/lib/sync/sync-context'
import { useAuth } from '@/hooks/use-auth'
import { disableGuestMode, markPendingGuestMigration } from '@/lib/auth/local-mode'
import type { SyncState } from '@/lib/sync/sync-engine'

// Іконка стану синхронізації у правому верхньому куті.
// При тапі — показує деталі + кнопку повного оновлення (pull + push).
export function SyncStatusIndicator() {
  const { syncState, manualSync } = useSyncContext()
  const { isGuest } = useAuth()
  const navigate = useNavigate()
  const [showDetails, setShowDetails] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const handleManualSync = async () => {
    setRefreshing(true)
    try {
      await manualSync()
    } finally {
      setRefreshing(false)
    }
  }

  const config = SYNC_STATE_CONFIG[syncState]

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setShowDetails((v) => !v)}
        className="p-1.5 rounded-full transition-opacity active:opacity-60"
        aria-label={`Синхронізація: ${config.label}`}
      >
        <config.Icon
          size={20}
          color={config.color}
          className={syncState === 'syncing' ? 'animate-spin' : undefined}
        />
      </button>

      {/* Деталі — дропдаун нижче кнопки */}
      {showDetails && (
        <div
          className="absolute right-0 rounded-2xl p-4 z-50 shadow-xl min-w-48"
          style={{ top: 'calc(100% + 4px)', backgroundColor: 'var(--color-bg-card)' }}
        >
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            {config.label}
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            {config.description}
          </p>
          {syncState === 'local-only' ? (
            <button
              onClick={() => {
                if (isGuest) {
                  // Позначаємо гостьові дані на перенесення (як і кнопка
                  // "Створити акаунт" у Налаштуваннях) — інакше після входу
                  // через Google локальні дані лишаться "осиротілими".
                  markPendingGuestMigration()
                  disableGuestMode()
                  // navigate(), не window.location.href — див. коментар у LoginScreen.tsx
                  setShowDetails(false)
                  navigate('/login')
                } else {
                  setShowDetails(false)
                  navigate('/settings')
                }
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl"
              style={{ backgroundColor: 'var(--color-accent)', color: '#1B2A2A' }}
            >
              {isGuest ? 'Авторизуйтесь, щоб синхронізувати' : 'Увімкнути в Налаштуваннях'}
            </button>
          ) : (
            /* Завжди доступна, не лише при pending/error — тягне свіжі дані
               з інших пристроїв (pull), а не тільки відправляє локальні
               зміни (те, що робив старий triggerSync). */
            <button
              onClick={handleManualSync}
              disabled={refreshing || syncState === 'offline'}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-accent)', color: '#1B2A2A' }}
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Оновлюємо...' : 'Оновити дані'}
            </button>
          )}
          <button
            onClick={() => setShowDetails(false)}
            className="block mt-2 text-xs"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Закрити
          </button>
        </div>
      )}
    </div>
  )
}

const SYNC_STATE_CONFIG: Record<SyncState, {
  Icon: typeof CheckCircle2
  color: string
  label: string
  description: string
}> = {
  idle: {
    Icon: CheckCircle2,
    color: 'var(--color-income)',
    label: 'Синхронізовано',
    description: 'Всі дані актуальні',
  },
  syncing: {
    Icon: Loader2,
    color: 'var(--color-accent)',
    label: 'Синхронізація...',
    description: 'Відправляємо дані в хмару',
  },
  pending: {
    Icon: AlertCircle,
    color: 'var(--color-fab)',
    label: 'Очікує синхронізації',
    description: 'Є незбережені зміни',
  },
  error: {
    Icon: AlertCircle,
    color: 'var(--color-expense)',
    label: 'Помилка синхронізації',
    description: 'Не вдалось відправити деякі записи',
  },
  offline: {
    Icon: WifiOff,
    color: 'var(--color-text-secondary)',
    label: 'Офлайн',
    description: 'Зміни збережено локально і відправляться при підключенні',
  },
  'local-only': {
    Icon: CloudOff,
    color: 'var(--color-fab)',
    label: 'Локальний режим',
    description: 'Дані зберігаються лише на цьому пристрої, синхронізація вимкнена',
  },
}
