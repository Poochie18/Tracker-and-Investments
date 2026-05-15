import { useContext } from 'react'
import { SyncStatusContext } from '@/lib/sync/sync-context'

// Хук для читання поточного стану синхронізації.
// Використовується в SyncStatusIndicator.
export function useSyncStatus() {
  const ctx = useContext(SyncStatusContext)
  if (!ctx) throw new Error('useSyncStatus: не знайдено SyncStatusContext. Обгорни додаток у SyncProvider.')
  return ctx
}
