import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/db'

// Хук для отримання першого (головного) рахунку користувача.
// MVP: один рахунок "Головний" — мультирахунок в майбутніх фазах.

export function useAccount(userId: string | undefined) {
  return useQuery({
    queryKey: ['account', userId],
    queryFn: async () => {
      const accounts = await db.accounts
        .where('user_id')
        .equals(userId!)
        .filter((a) => !a.is_archived)
        .toArray()
      return accounts[0] ?? null
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
  })
}
