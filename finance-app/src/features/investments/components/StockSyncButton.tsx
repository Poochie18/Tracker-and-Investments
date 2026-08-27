import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useSyncContext } from '@/lib/sync/sync-context'
import { useSyncStockPrices } from '@/hooks/use-stock-prices'

// Кнопка синку в шапці вкладки "Акції" — замінює SyncStatusIndicator, як і
// CryptoSyncButton: тап тягне поточні ціни через Finnhub (лише для акцій із
// заповненим тікером) і одночасно пушить/пуляє звичайні дані (manualSync).
export function StockSyncButton() {
  const { user } = useAuth()
  const syncPrices = useSyncStockPrices(user?.id ?? '')
  const { manualSync } = useSyncContext()
  const [syncing, setSyncing] = useState(false)

  const handleSync = async () => {
    setSyncing(true)
    try {
      await syncPrices.mutateAsync()
      await manualSync()
    } catch {
      // Тихо — так само, як CryptoSyncButton: без модалки, статус
      // _sync_status='error' і так побачить наступний manualSync/автосинк.
    } finally {
      setSyncing(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={syncing}
      className="p-1.5 rounded-full transition-opacity active:opacity-60 disabled:opacity-60"
      aria-label="Оновити ціни акцій"
      title="Оновити ціни акцій"
    >
      <RefreshCw
        size={20}
        color="var(--color-accent)"
        className={syncing ? 'animate-spin' : ''}
      />
    </button>
  )
}
