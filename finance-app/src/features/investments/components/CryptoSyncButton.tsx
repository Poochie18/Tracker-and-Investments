import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useSyncContext } from '@/lib/sync/sync-context'
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator'
import { useBinanceConnectionStatus, useSyncBinanceBalances } from '@/hooks/use-crypto-exchange'

// Єдина кнопка синхронізації в шапці вкладки "Крипта" — замінює і окрему
// Binance-кнопку, і загальний SyncStatusIndicator, щоб на екрані не було
// двох однакових на вигляд кнопок поруч (раніше саме так і було). Коли
// Binance підключено — тап тягне і баланси з біржі, і пушить/пуляє звичайні
// дані (manualSync), нічого не відкриваючи, лише крутиться іконка. Коли
// Binance ще не підключено — нічого крипто-специфічного синкати, тож
// просто показуємо звичайний SyncStatusIndicator (він і так лишається
// єдиною кнопкою на екрані).
export function CryptoSyncButton() {
  const { user } = useAuth()
  const { data: status } = useBinanceConnectionStatus()
  const syncBinance = useSyncBinanceBalances(user?.id ?? '')
  const { manualSync } = useSyncContext()
  const [syncing, setSyncing] = useState(false)

  if (!status?.connected) return <SyncStatusIndicator />

  const handleSync = async () => {
    setSyncing(true)
    try {
      await syncBinance.mutateAsync()
      // Пушимо щойно записані Dexie-зміни одразу, а не чекаємо періодичний
      // авто-синк (SYNC_INTERVAL_MS) — і одночасно тягнемо будь-які свіжі
      // дані з інших пристроїв.
      await manualSync()
    } catch {
      // Тихо — без модалки/повідомлення за задумом; статус самого запису
      // (_sync_status='error') і так побачить наступний manualSync/автосинк.
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
      aria-label="Синхронізувати"
      title="Синхронізувати"
    >
      <RefreshCw
        size={20}
        color="var(--color-accent)"
        className={syncing ? 'animate-spin' : ''}
      />
    </button>
  )
}
