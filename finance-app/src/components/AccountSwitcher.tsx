import { useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import type { LocalAccount } from '@/lib/db/schema'

interface AccountSwitcherProps {
  accounts: LocalAccount[]
  activeAccountId: string | undefined
  onSelect: (id: string) => void
}

// Перемикач активного рахунку — показує назву поточного, при тапі
// відкриває дропдаун зі списком (стиль як у SyncStatusIndicator).
// Якщо рахунок лише один — рендериться як звичайний напис без шеврону/дропдауну.
export function AccountSwitcher({ accounts, activeAccountId, onSelect }: AccountSwitcherProps) {
  const [open, setOpen] = useState(false)
  const active = accounts.find((a) => a.id === activeAccountId)

  if (accounts.length <= 1) {
    return (
      <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        {active?.name ?? ''}
      </p>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs font-medium active:opacity-70"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {active?.name ?? 'Рахунок'}
        <ChevronDown size={14} />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute left-0 rounded-2xl p-1.5 z-50 shadow-xl min-w-40"
            style={{ top: 'calc(100% + 4px)', backgroundColor: 'var(--color-bg-card)' }}
          >
            {accounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => {
                  onSelect(acc.id)
                  setOpen(false)
                }}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-left"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <Check
                  size={14}
                  style={{ visibility: acc.id === activeAccountId ? 'visible' : 'hidden' }}
                  color="var(--color-accent)"
                />
                {acc.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
