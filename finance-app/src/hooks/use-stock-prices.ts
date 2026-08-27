import { useMutation, useQueryClient } from '@tanstack/react-query'
import { stockPriceRepo } from '@/features/investments/repositories/stock-price-repo'
import { investmentKeys } from './use-investments'

// Кнопка синку в шапці вкладки "Акції" — тягне поточні ціни для всіх акцій
// із заповненим тікером через Edge Function stock-price-sync (Finnhub).
export function useSyncStockPrices(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => stockPriceRepo.syncPrices(userId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: investmentKeys.all(userId) }),
  })
}
