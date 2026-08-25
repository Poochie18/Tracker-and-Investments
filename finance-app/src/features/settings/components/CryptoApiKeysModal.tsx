import { useState } from 'react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { KeyRound, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import {
  useBinanceConnectionStatus, useSaveBinanceKeys, useDisconnectBinance, useSyncBinanceBalances,
} from '@/hooks/use-crypto-exchange'
import { useAuth } from '@/hooks/use-auth'

// Модалка керування API-ключами бірж (Налаштування → Інвестиції).
// Список ключів (зараз підтримується лише Binance, тому 0 або 1 рядок) —
// дані завжди за зірочками, показуємо тільки назву й останні 4 символи
// ключа (key_last4 — не секрет, зберігається саме для цього показу).
// Сам ключ/секрет ніде на клієнті не зберігається і не читається назад —
// лише пишеться одноразово при збереженні.
export function CryptoApiKeysModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const { data: status, isLoading } = useBinanceConnectionStatus()
  const saveKeys = useSaveBinanceKeys()
  const disconnect = useDisconnectBinance(user?.id ?? '')
  const syncBalances = useSyncBinanceBalances(user?.id ?? '')

  const [showForm, setShowForm] = useState(false)
  const [label, setLabel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [syncingAfterSave, setSyncingAfterSave] = useState(false)

  const handleSave = async () => {
    setError(null)
    if (!apiKey.trim() || !apiSecret.trim()) {
      setError('Введи і ключ, і секрет')
      return
    }
    try {
      await saveKeys.mutateAsync({ apiKey, apiSecret, label: label.trim() || undefined })
      setLabel('')
      setApiKey('')
      setApiSecret('')
      setShowForm(false)

      // Одразу тягнемо баланси — без цього вкладка "Крипта" лишалась би
      // порожньою до наступного разу, коли хтось натисне кнопку синку
      // (баланс з'являється лише ПІСЛЯ першого синку, ключ сам по собі
      // нічого не підтягує). Помилку тут не показуємо як фатальну — ключ
      // уже збережено успішно, а синк завжди можна повторити кнопкою в шапці.
      setSyncingAfterSave(true)
      try {
        await syncBalances.mutateAsync()
      } catch {
        // ігноруємо — ключ збережено, спробує ще раз при наступному синку
      } finally {
        setSyncingAfterSave(false)
      }
    } catch {
      setError('Не вдалось зберегти ключ. Перевір, що він правильний.')
    }
  }

  const handleDelete = async () => {
    setError(null)
    try {
      await disconnect.mutateAsync()
      setConfirmDelete(false)
    } catch {
      // Раніше помилка тут просто зникала — confirmDelete лишався true,
      // кнопка розблоковувалась назад, а користувач не бачив, що щось
      // пішло не так (виглядало, ніби видалення просто нічого не робить).
      setError('Не вдалось видалити ключ. Спробуй ще раз.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-t-3xl p-6 pb-10 flex flex-col gap-4 max-h-[85vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--color-bg-card)' }}
      >
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            API-ключі бірж
          </p>
          <button type="button" onClick={onClose} className="p-1">
            <X size={20} color="var(--color-text-secondary)" />
          </button>
        </div>

        {!isLoading && (
          <div className="flex flex-col gap-2">
            {status?.connected ? (
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
              >
                <KeyRound size={18} color="var(--color-text-secondary)" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {status.label || 'Binance'}
                  </p>
                  <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                    •••• •••• •••• {status.keyLast4 ?? '••••'}
                  </p>
                  {status.connectedAt && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                      Підключено {format(new Date(status.connectedAt), 'd MMMM yyyy', { locale: uk })}
                    </p>
                  )}
                  {syncingAfterSave && (
                    <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--color-accent)' }}>
                      <RefreshCw size={11} className="animate-spin" />
                      Тягнемо баланси...
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={syncingAfterSave}
                  className="p-2 rounded-xl flex-shrink-0 disabled:opacity-50"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                  title="Видалити ключ"
                >
                  <Trash2 size={16} color="var(--color-expense)" />
                </button>
              </div>
            ) : (
              <p className="text-xs px-1" style={{ color: 'var(--color-text-secondary)' }}>
                Ще немає підключених ключів.
              </p>
            )}
          </div>
        )}

        {!status?.connected && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-semibold"
            style={{ backgroundColor: 'var(--color-accent)', color: '#1B2A2A' }}
          >
            <Plus size={16} />
            Додати ключ
          </button>
        )}

        {!status?.connected && showForm && (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Назва ключа (напр. Основний Binance)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full text-sm px-3 py-2.5 rounded-xl bg-transparent border-none outline-none"
              style={{ color: 'var(--color-text-primary)', backgroundColor: 'rgba(255,255,255,0.06)' }}
            />
            <input
              type="text"
              placeholder="API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full text-sm px-3 py-2.5 rounded-xl bg-transparent border-none outline-none"
              style={{ color: 'var(--color-text-primary)', backgroundColor: 'rgba(255,255,255,0.06)' }}
            />
            <input
              type="password"
              placeholder="API Secret"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              className="w-full text-sm px-3 py-2.5 rounded-xl bg-transparent border-none outline-none"
              style={{ color: 'var(--color-text-primary)', backgroundColor: 'rgba(255,255,255,0.06)' }}
            />
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Ключ з правами лише читання (Enable Reading, без Trading/Withdraw).
            </p>
            {error && <p className="text-xs" style={{ color: 'var(--color-expense)' }}>{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saveKeys.isPending}
                className="flex-1 py-2.5 rounded-2xl text-sm font-semibold disabled:opacity-60"
                style={{ backgroundColor: 'var(--color-accent)', color: '#1B2A2A' }}
              >
                {saveKeys.isPending ? 'Зберігаємо...' : 'Зберегти'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-2xl text-sm font-semibold"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-text-primary)' }}
              >
                Скасувати
              </button>
            </div>
          </div>
        )}

        {confirmDelete && (
          <div className="flex flex-col gap-2 p-4 rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
            <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
              Видалити цей ключ? Автосинхронізація балансів припиниться.
            </p>
            {error && <p className="text-xs" style={{ color: 'var(--color-expense)' }}>{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={disconnect.isPending}
                className="flex-1 py-2.5 rounded-2xl text-sm font-semibold disabled:opacity-60"
                style={{ backgroundColor: 'var(--color-expense)', color: '#fff' }}
              >
                {disconnect.isPending ? 'Видаляємо...' : 'Видалити'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2.5 rounded-2xl text-sm font-semibold"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--color-text-primary)' }}
              >
                Скасувати
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
