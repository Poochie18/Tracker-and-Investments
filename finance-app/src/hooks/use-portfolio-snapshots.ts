import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  portfolioSnapshotsRepo,
  type SavePortfolioSnapshotInput,
} from '@/features/investments/repositories/portfolio-snapshots-repo'

export const portfolioSnapshotKeys = {
  all: (userId: string) => ['portfolio-snapshots', userId] as const,
}

export function usePortfolioSnapshots(userId: string | undefined) {
  return useQuery({
    queryKey: portfolioSnapshotKeys.all(userId ?? ''),
    queryFn: () => portfolioSnapshotsRepo.getAll(userId!),
    enabled: !!userId,
  })
}

export function useSavePortfolioSnapshot(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SavePortfolioSnapshotInput) => portfolioSnapshotsRepo.save(userId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: portfolioSnapshotKeys.all(userId) })
    },
  })
}
