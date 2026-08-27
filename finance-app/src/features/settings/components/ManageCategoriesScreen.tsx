import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Archive, RotateCcw, Check, Pencil } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useQueryClient } from '@tanstack/react-query'
import { db } from '@/lib/db'
import { categoriesRepo } from '@/features/transactions/repositories/categories-repo'
import { getCategoryIcon, ICON_NAMES } from '@/lib/utils/category-icons'
import { CategoryIconCircle } from '@/features/transactions/components/CategoryIconCircle'
import { SwipeToReveal } from '@/components/SwipeToReveal'
import type { LocalCategory, TransactionType } from '@/lib/db/schema'
import { useQuery, useMutation } from '@tanstack/react-query'

// ── Константи ─────────────────────────────────────────────

const PRESET_COLORS = [
  '#00c896', '#f4b942', '#ff6b6b', '#51cf66', '#74c0fc',
  '#ff922b', '#da77f2', '#f783ac', '#a9e34b', '#66d9e8',
  '#ff6b6b', '#ffa94d', '#c0eb75', '#63e6be', '#4dabf7',
  '#e599f7',
]

// ── Хуки ──────────────────────────────────────────────────

function useAllCategories(userId: string) {
  return useQuery({
    queryKey: ['categories-all', userId],
    queryFn: () =>
      db.categories.where('user_id').equals(userId).sortBy('sort_order'),
    enabled: !!userId,
  })
}

function useToggleArchive(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isArchived }: { id: string; isArchived: boolean }) => {
      const cat = await db.categories.get(id)
      if (cat?.is_system && !isArchived) return
      if (cat?.is_system) throw new Error('Системну категорію не можна архівувати')
      await db.categories.update(id, {
        is_archived: !isArchived,
        updated_at: new Date().toISOString(),
        _sync_status: 'pending',
        _local_updated_at: Date.now(),
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories-all', userId] })
      void queryClient.invalidateQueries({ queryKey: ['categories', userId] })
    },
  })
}

// ── Компонент ─────────────────────────────────────────────

export function ManageCategoriesScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const { data: categories = [] } = useAllCategories(userId)
  const toggleArchive = useToggleArchive(userId)

  const [activeTab, setActiveTab] = useState<TransactionType>('expense')
  const [showCreate, setShowCreate] = useState(false)
  const [editingCategory, setEditingCategory] = useState<LocalCategory | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const filtered = categories.filter(
    (c) => c.type === activeTab && (showArchived ? c.is_archived : !c.is_archived)
  )

  return (
    <div
      className="flex flex-col min-h-full"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
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
          Категорії
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="p-1.5 rounded-full"
          style={{ backgroundColor: 'var(--color-accent)', color: '#1B2A2A' }}
        >
          <Plus size={18} />
        </button>
      </div>

      {/* ── Таби витрати/доходи ───────────────────────────── */}
      <div className="flex px-4 pt-3 gap-2">
        {(['expense', 'income'] as TransactionType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              backgroundColor: activeTab === tab ? 'var(--color-accent)' : 'var(--color-bg-card)',
              color: activeTab === tab ? '#1B2A2A' : 'var(--color-text-secondary)',
            }}
          >
            {tab === 'expense' ? 'Витрати' : 'Доходи'}
          </button>
        ))}
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

      {/* ── Список ────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 p-4">
        {filtered.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
            {showArchived ? 'Архів порожній' : 'Немає категорій'}
          </p>
        )}
        {filtered.map((cat) => (
          <CategoryRow
            key={cat.id}
            category={cat}
            onToggle={() => toggleArchive.mutate({ id: cat.id, isArchived: cat.is_archived })}
            onEdit={() => setEditingCategory(cat)}
          />
        ))}
      </div>

      {/* ── Форма створення / редагування ─────────────────── */}
      {(showCreate || editingCategory) && (
        <CategorySheet
          userId={userId}
          defaultType={activeTab}
          category={editingCategory}
          onClose={() => {
            setShowCreate(false)
            setEditingCategory(null)
          }}
        />
      )}
    </div>
  )
}

// ── Рядок категорії (свайп для архіву) ───────────────────

function CategoryRow({
  category,
  onToggle,
  onEdit,
}: {
  category: LocalCategory
  onToggle: () => void
  onEdit: () => void
}) {
  const actionColor = category.is_archived ? 'var(--color-accent)' : 'rgba(255,107,107,0.85)'
  const ActionIcon = category.is_archived ? RotateCcw : Archive

  return (
    <div className="rounded-2xl overflow-hidden">
      {category.is_system ? (
        // Системні — без свайпу (архівувати не можна), але редагувати можна
        <div
          className="flex items-center gap-3 px-3 py-3"
          style={{ backgroundColor: 'var(--color-bg-card)' }}
        >
          <CategoryRowContent category={category} onEdit={onEdit} />
        </div>
      ) : (
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
                {category.is_archived ? 'Відновити' : 'Архів'}
              </span>
            </button>
          )}
        >
          <div
            className="flex items-center gap-3 px-3 py-3"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              opacity: category.is_archived ? 0.6 : 1,
            }}
          >
            <CategoryRowContent category={category} onEdit={onEdit} />
          </div>
        </SwipeToReveal>
      )}
    </div>
  )
}

function CategoryRowContent({ category, onEdit }: { category: LocalCategory; onEdit: () => void }) {
  return (
    <>
      <CategoryIconCircle iconName={category.icon_name} colorHex={category.color_hex} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
          {category.name}
        </p>
        {category.is_system && (
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            системна
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="p-2 -m-2 shrink-0"
        aria-label="Редагувати категорію"
      >
        <Pencil size={16} style={{ color: 'var(--color-text-secondary)' }} />
      </button>
    </>
  )
}

// ── Bottom Sheet для створення / редагування ──────────────

function CategorySheet({
  userId,
  defaultType,
  category,
  onClose,
}: {
  userId: string
  defaultType: TransactionType
  category: LocalCategory | null
  onClose: () => void
}) {
  const isEditing = category !== null
  const queryClient = useQueryClient()
  const [name, setName] = useState(category?.name ?? '')
  const [type, setLocalType] = useState<TransactionType>(category?.type ?? defaultType)
  const [iconName, setIconName] = useState(category?.icon_name ?? 'MoreHorizontal')
  const [colorHex, setColorHex] = useState(category?.color_hex ?? '#00c896')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Введіть назву")
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (isEditing) {
        await categoriesRepo.update(category.id, { name: name.trim(), icon_name: iconName, color_hex: colorHex })
      } else {
        await categoriesRepo.create(userId, { name: name.trim(), type, icon_name: iconName, color_hex: colorHex })
      }
      void queryClient.invalidateQueries({ queryKey: ['categories-all', userId] })
      void queryClient.invalidateQueries({ queryKey: ['categories', userId] })
      onClose()
    } catch {
      setError(isEditing ? 'Не вдалось зберегти зміни' : 'Не вдалось створити категорію')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-lg rounded-t-3xl p-5 pb-8 flex flex-col gap-4 overflow-y-auto max-h-[85vh]"
        style={{ backgroundColor: 'var(--color-bg-card)' }}
      >
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {isEditing ? 'Редагувати категорію' : 'Нова категорія'}
          </p>
          <button onClick={onClose} className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Закрити
          </button>
        </div>

        {/* Тип — при редагуванні незмінний (щоб не плутати вже занесені транзакції) */}
        {isEditing ? (
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Тип: {type === 'expense' ? 'Витрата' : 'Дохід'}
          </p>
        ) : (
          <div className="flex gap-2">
            {(['expense', 'income'] as TransactionType[]).map((t) => (
              <button
                key={t}
                onClick={() => setLocalType(t)}
                className="flex-1 py-2 rounded-xl text-sm font-medium"
                style={{
                  backgroundColor: type === t ? 'var(--color-accent)' : 'rgba(255,255,255,0.06)',
                  color: type === t ? '#1B2A2A' : 'var(--color-text-secondary)',
                }}
              >
                {t === 'expense' ? 'Витрата' : 'Дохід'}
              </button>
            ))}
          </div>
        )}

        {/* Назва */}
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            Назва
          </p>
          <input
            type="text"
            placeholder="Назва категорії"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-sm bg-transparent outline-none py-2"
            style={{
              color: 'var(--color-text-primary)',
              borderBottom: '1px solid rgba(255,255,255,0.12)',
            }}
            autoFocus
          />
        </div>

        {/* Іконка */}
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Іконка
          </p>
          <div className="grid grid-cols-6 gap-2">
            {ICON_NAMES.map((name) => {
              const Icon = getCategoryIcon(name)
              const selected = iconName === name
              return (
                <button
                  key={name}
                  onClick={() => setIconName(name)}
                  className="flex items-center justify-center w-10 h-10 rounded-xl transition-all"
                  style={{
                    backgroundColor: selected ? colorHex + '33' : 'rgba(255,255,255,0.06)',
                    outline: selected ? `2px solid ${colorHex}` : '2px solid transparent',
                  }}
                >
                  <Icon size={18} color={selected ? colorHex : 'var(--color-text-secondary)'} />
                </button>
              )
            })}
          </div>
        </div>

        {/* Колір */}
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Колір
          </p>
          <div className="grid grid-cols-8 gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setColorHex(color)}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: color }}
              >
                {colorHex === color && <Check size={14} color="#fff" />}
              </button>
            ))}
          </div>
        </div>

        {/* Превʼю */}
        <div className="flex items-center gap-3 py-2">
          <CategoryIconCircle iconName={iconName} colorHex={colorHex} size="md" />
          <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
            {name || 'Назва категорії'}
          </p>
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
          {saving ? 'Зберігаємо...' : isEditing ? 'Зберегти' : 'Створити'}
        </button>
      </div>
    </div>
  )
}
