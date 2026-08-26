import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Archive, RotateCcw, Landmark } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { accountsRepo } from '@/features/transactions/repositories/accounts-repo'
import { SwipeToReveal } from '@/components/SwipeToReveal'
import type { LocalAccount } from '@/lib/db/schema'

// ── Хуки ──────────────────────────────────────────────────

function useAllAccounts(userId: string) {
  return useQuery({
    queryKey: ['accounts-all', userId],
    queryFn: () => accountsRepo.getAll(userId),
    enabled: !!userId,
  })
}

function invalidateAccountQueries(queryClient: ReturnType<typeof useQueryClient>, userId: string) {
  void queryClient.invalidateQueries({ queryKey: ['accounts-all', userId] })
  void queryClient.invalidateQueries({ queryKey: ['accounts', userId] })
}

function useToggleArchive(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isArchived }: { id: string; isArchived: boolean }) => {
      if (isArchived) {
        await accountsRepo.restore(id)
      } else {
        await accountsRepo.archive(userId, id)
      }
    },
    onSuccess: () => invalidateAccountQueries(queryClient, userId),
  })
}

// ── Компонент ─────────────────────────────────────────────

export function ManageAccountsScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const { data: accounts = [] } = useAllAccounts(userId)
  const toggleArchive = useToggleArchive(userId)

  const [showCreate, setShowCreate] = useState(false)
  const [editingAccount, setEditingAccount] = useState<LocalAccount | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = accounts.filter((a) => (showArchived ? a.is_archived : !a.is_archived))

  const handleToggle = async (account: LocalAccount) => {
    setError(null)
    try {
      await toggleArchive.mutateAsync({ id: account.id, isArchived: account.is_archived })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалось змінити рахунок')
    }
  }

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      {/* ── Шапка ─────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 pb-4"
        style={{
          backgroundColor: 'var(--color-bg-header)',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        }}
      >
        <button onClick={() => navigate(-1)} className="p-1 -ml-1">
          <ArrowLeft size={22} style={{ color: 'var(--color-text-primary)' }} />
        </button>
        <h1 className="text-lg font-semibold flex-1" style={{ color: 'var(--color-text-primary)' }}>
          Рахунки
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="p-1.5 rounded-full"
          style={{ backgroundColor: 'var(--color-accent)', color: '#1B2A2A' }}
        >
          <Plus size={18} />
        </button>
      </div>

      {/* ── Показати архів ────────────────────────────────── */}
      <div className="px-4 pt-3">
        <button
          onClick={() => setShowArchived(!showArchived)}
          className="text-xs font-medium"
          style={{ color: showArchived ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}
        >
          {showArchived ? '← Активні' : 'Показати архів'}
        </button>
      </div>

      {error && (
        <p className="px-4 pt-2 text-sm" style={{ color: 'var(--color-expense)' }}>
          {error}
        </p>
      )}

      {/* ── Список ────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 p-4">
        {filtered.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
            {showArchived ? 'Архів порожній' : 'Немає рахунків'}
          </p>
        )}
        {filtered.map((acc) => (
          <AccountRow
            key={acc.id}
            account={acc}
            onToggle={() => handleToggle(acc)}
            onPress={() => setEditingAccount(acc)}
          />
        ))}
      </div>

      {/* ── Форма створення ───────────────────────────────── */}
      {showCreate && <CreateAccountSheet userId={userId} onClose={() => setShowCreate(false)} />}

      {/* ── Форма перейменування ──────────────────────────── */}
      {editingAccount && (
        <CreateAccountSheet
          userId={userId}
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
        />
      )}
    </div>
  )
}

// ── Рядок рахунку (свайп для архіву, тап для перейменування) ─

function AccountRow({
  account,
  onToggle,
  onPress,
}: {
  account: LocalAccount
  onToggle: () => void
  onPress: () => void
}) {
  const actionColor = account.is_archived ? 'var(--color-accent)' : 'rgba(255,107,107,0.85)'
  const ActionIcon = account.is_archived ? RotateCcw : Archive

  return (
    <div className="rounded-2xl overflow-hidden">
      <SwipeToReveal
        actionWidth={72}
        action={(close) => (
          <button
            onClick={() => { close(); onToggle() }}
            className="flex-1 flex flex-col items-center justify-center gap-1"
            style={{ backgroundColor: actionColor, color: '#fff' }}
          >
            <ActionIcon size={18} />
            <span className="text-xs font-medium">
              {account.is_archived ? 'Відновити' : 'Архів'}
            </span>
          </button>
        )}
      >
        <button
          type="button"
          onClick={onPress}
          className="flex items-center gap-3 px-3 py-3 w-full text-left"
          style={{ backgroundColor: 'var(--color-bg-card)', opacity: account.is_archived ? 0.6 : 1 }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'var(--color-bg-header)' }}
          >
            <Landmark size={16} style={{ color: 'var(--color-accent)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
              {account.name}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {account.currency}
            </p>
          </div>
        </button>
      </SwipeToReveal>
    </div>
  )
}

// ── Bottom Sheet для створення ────────────────────────────

function CreateAccountSheet({
  userId,
  account,
  onClose,
}: {
  userId: string
  account?: LocalAccount
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(account?.name ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Введіть назву')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (account) {
        await accountsRepo.rename(account.id, name.trim())
      } else {
        await accountsRepo.create(userId, { name: name.trim() })
      }
      invalidateAccountQueries(queryClient, userId)
      onClose()
    } catch {
      setError(account ? 'Не вдалось перейменувати рахунок' : 'Не вдалось створити рахунок')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-t-3xl p-5 pb-8 flex flex-col gap-4"
        style={{ backgroundColor: 'var(--color-bg-card)' }}
      >
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {account ? 'Перейменувати рахунок' : 'Новий рахунок'}
          </p>
          <button onClick={onClose} className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Закрити
          </button>
        </div>

        <div>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            Назва
          </p>
          <input
            type="text"
            placeholder="напр. Робочий"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-sm bg-transparent outline-none py-2"
            style={{ color: 'var(--color-text-primary)', borderBottom: '1px solid rgba(255,255,255,0.12)' }}
            autoFocus
          />
        </div>

        {error && (
          <p className="text-sm" style={{ color: 'var(--color-expense)' }}>
            {error}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-2xl font-semibold text-sm transition-opacity disabled:opacity-60"
          style={{ backgroundColor: 'var(--color-accent)', color: '#1B2A2A' }}
        >
          {saving ? 'Зберігаємо...' : 'Створити'}
        </button>
      </div>
    </div>
  )
}
