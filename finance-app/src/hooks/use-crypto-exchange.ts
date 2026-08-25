import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cryptoExchangeRepo } from '@/features/investments/repositories/crypto-exchange-repo'
import { investmentKeys } from './use-investments'

export function useBinanceConnectionStatus() {
  return useQuery({
    queryKey: ['binance-connection'],
    queryFn: () => cryptoExchangeRepo.getConnectionStatus(),
    staleTime: 1000 * 60,
    retry: 1,
  })
}

export function useSaveBinanceKeys() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ apiKey, apiSecret, label }: { apiKey: string; apiSecret: string; label?: string }) =>
      cryptoExchangeRepo.saveBinanceKeys(apiKey, apiSecret, label),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['binance-connection'] }),
  })
}

export function useDisconnectBinance(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => cryptoExchangeRepo.disconnectBinance(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['binance-connection'] })
      // Синхронізовані монети щойно soft-delete'нуто локально — без цього
      // вкладка "Крипта" ще показувала б старі баланси до наступного
      // рефетчу useInvestments.
      void queryClient.invalidateQueries({ queryKey: investmentKeys.all(userId) })
    },
  })
}

// "Сирітське" прибирання: якщо Binance вже НЕ підключено, а в портфелі
// лишились монети зі старого синку (напр. ключ видалили ДО того, як
// disconnectBinance навчився чистити їх сам) — прибираємо їх один раз при
// заході на вкладку "Крипта". Викликай лише там (activeType === 'crypto'),
// не глобально — інакше зайвий Dexie-прохід на кожному екрані застосунку.
export function useCleanupOrphanedCryptoSync(userId: string | undefined, enabled: boolean): void {
  const { data: status } = useBinanceConnectionStatus()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled || !userId || !status || status.connected) return
    void cryptoExchangeRepo.cleanupOrphanedSyncedCrypto(userId).then((removedAny) => {
      if (removedAny) void queryClient.invalidateQueries({ queryKey: investmentKeys.all(userId) })
    })
  }, [enabled, userId, status, queryClient])
}

export function useSyncBinanceBalances(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => cryptoExchangeRepo.syncBinanceBalances(userId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: investmentKeys.all(userId) }),
  })
}
