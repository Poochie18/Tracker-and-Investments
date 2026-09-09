import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userInvestmentSettingsRepo } from '@/features/investments/repositories/user-investment-settings-repo'
import type { LocalUserInvestmentSettings } from '@/lib/db/schema'
import { useSyncContext } from '@/lib/sync/sync-context'

export const userInvestmentSettingsKeys = {
  detail: (userId: string) => ['user-investment-settings', userId] as const,
}

export function useUserInvestmentSettings(userId: string | undefined) {
  return useQuery({
    queryKey: userInvestmentSettingsKeys.detail(userId ?? ''),
    queryFn: () => userInvestmentSettingsRepo.get(userId!),
    enabled: !!userId,
  })
}

type SettingsPatch = Partial<
  Pick<
    LocalUserInvestmentSettings,
    'free_cash_usd_minor' | 'stock_manual_invested_usd_minor' | 'crypto_manual_invested_usd_minor'
  >
>

export function useUpdateUserInvestmentSettings(userId: string) {
  const queryClient = useQueryClient()
  const { triggerSync } = useSyncContext()

  return useMutation({
    mutationFn: (patch: SettingsPatch) => userInvestmentSettingsRepo.update(userId, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userInvestmentSettingsKeys.detail(userId) })
      triggerSync()
    },
  })
}
