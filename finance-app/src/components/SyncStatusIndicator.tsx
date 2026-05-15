import { useState } from 'react'
import { CheckCircle2, Loader2, WifiOff, AlertCircle } from 'lucide-react'
import { useSyncContext } from '@/lib/sync/sync-context'
import type { SyncState } from '@/lib/sync/sync-engine'

// Іконка стану синхронізації у правому верхньому куті.
// При тапі — показує деталі.
export function SyncStatusIndicator() {
  const { syncState, triggerSync } = useSyncContext()
  const [showDetails, setShowDetails] = useState(false)

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
          {(syncState === 'pending' || syncState === 'error') && (
            <button
              onClick={() => { triggerSync(); setShowDetails(false) }}
              className="text-xs px-3 py-1.5 rounded-xl"
              style={{ backgroundColor: 'var(--color-accent)', color: '#1B2A2A' }}
            >
              Синхронізувати зараз
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
}
