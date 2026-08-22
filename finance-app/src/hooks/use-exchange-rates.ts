import { useQuery } from '@tanstack/react-query'
import { fetchExchangeRates } from '@/lib/investments/exchange-rate'

// Курси НБУ — кешуємо годину в TanStack Query (сам fetchExchangeRates
// додатково кешує в localStorage на 6 годин і має fallback на офлайн).
export function useExchangeRates() {
  return useQuery({
    queryKey: ['exchange-rates'],
    queryFn: fetchExchangeRates,
    staleTime: 1000 * 60 * 60,
    retry: 1,
  })
}
