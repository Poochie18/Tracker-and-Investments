import { useEffect, useRef } from 'react'
import { useAuth } from './use-auth'
import { useSyncStockPrices } from './use-stock-prices'
import { useBinanceConnectionStatus, useSyncBinanceBalances } from './use-crypto-exchange'
import { onlineDetector } from '@/lib/sync/online-detector'
import { isPriceSyncDue, setLastPriceSync } from '@/lib/investments/price-sync-timestamps'

// Як часто перевіряти, чи настав час автосинку (не сам інтервал синку —
// той AUTO_PRICE_SYNC_INTERVAL_MS у price-sync-timestamps.ts, 6 годин).
// 15 хв — щоб не пропустити момент через 6 год, поки застосунок відкритий,
// і дешево (лише читання localStorage), якщо синк ще не потрібен.
const CHECK_INTERVAL_MS = 15 * 60 * 1000

// Автоматично тягне свіжі ціни акцій (Finnhub) і баланси/ціни крипти
// (Binance) — без натискання StockSyncButton/CryptoSyncButton. Монтується
// один раз в AppLayout, а не на самих вкладках "Акції"/"Крипта" — так
// синк спрацьовує навіть якщо користувач сидить на "Огляді" чи іншому
// розділі. Ручні кнопки лишаються для форс-оновлення поза цим таймером.
export function usePriceAutoSync(): void {
  const { user } = useAuth()
  const userId = user?.id
  const syncStocks = useSyncStockPrices(userId ?? '')
  const syncCrypto = useSyncBinanceBalances(userId ?? '')
  const { data: binanceStatus } = useBinanceConnectionStatus()
  const binanceConnected = binanceStatus?.connected ?? false
  // Захист від паралельного повторного запуску (напр. visibilitychange і
  // тік інтервалу майже одночасно) — не keys для запиту, суто локальний lock.
  const runningRef = useRef(false)

  useEffect(() => {
    if (!userId) return

    const check = () => {
      if (runningRef.current || !onlineDetector.isOnline) return

      const dueStock = isPriceSyncDue(userId, 'stock')
      const dueCrypto = binanceConnected && isPriceSyncDue(userId, 'crypto')
      if (!dueStock && !dueCrypto) return

      runningRef.current = true
      void Promise.allSettled([
        dueStock
          ? syncStocks.mutateAsync().then(() => setLastPriceSync(userId, 'stock', Date.now()))
          : null,
        dueCrypto
          ? syncCrypto.mutateAsync().then(() => setLastPriceSync(userId, 'crypto', Date.now()))
          : null,
      ]).finally(() => {
        runningRef.current = false
      })
    }

    // Перевірка одразу при вході в додаток
    check()

    // Поки застосунок відкритий — періодична перевірка
    const intervalId = setInterval(check, CHECK_INTERVAL_MS)

    // На мобільних PWA JS-таймери призупиняються у фоні — перевіряємо
    // одразу при поверненні застосунку на екран, а не чекаємо тік інтервалу
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    // syncStocks/syncCrypto — нові об'єкти useMutation щорендеру, але
    // функціонально стабільні (той самий mutationFn); в deps лише те, що
    // реально змінює логіку перевірки.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, binanceConnected])
}
