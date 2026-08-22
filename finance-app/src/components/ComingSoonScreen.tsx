import type { LucideIcon } from 'lucide-react'
import { SyncStatusIndicator } from './SyncStatusIndicator'
import { AccountIconButton } from './AccountIconButton'

interface ComingSoonScreenProps {
  headerTitle: string
  icon: LucideIcon
  message: string
}

// Універсальна заглушка для сторінок, які ще не реалізовані
// (Графіки, Регулярні платежі тощо) — але вже мають місце в навігації.
export function ComingSoonScreen({ headerTitle, icon: Icon, message }: ComingSoonScreenProps) {
  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <div
        className="flex items-center justify-between px-4 pb-4"
        style={{
          backgroundColor: 'var(--color-bg-header)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        }}
      >
        <div className="flex items-center gap-2">
          <AccountIconButton />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {headerTitle}
          </h1>
        </div>
        <SyncStatusIndicator />
      </div>

      <div
        className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-6"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <Icon size={48} />
        <p className="text-center text-sm max-w-xs">{message}</p>
      </div>
    </div>
  )
}
