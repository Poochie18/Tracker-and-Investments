import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { SyncProvider } from '@/lib/sync/sync-context'
import { isFirstLogin, setupFirstLogin } from './first-login-setup'
import { clearPendingGuestMigration, getPendingGuestMigrationId, isGuestMode } from './local-mode'
import { migrateGuestDataToAccount } from './guest-migration'

export function AuthGuard() {
  const { user, loading } = useAuth()
  const [setupDone, setSetupDone] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  // Зростає при кожній повторній спробі — включений у deps ефекту нижче,
  // щоб можна було перезапустити сетап без переходу на новий user.
  const [retryTick, setRetryTick] = useState(0)
  // Захист від подвійного запуску (React StrictMode монтує ефекти двічі)
  const setupStarted = useRef(false)

  // Якщо сетап впав через офлайн — авто-ретрай, щойно з'явиться мережа,
  // замість того щоб змушувати користувача тицяти "Спробувати знову".
  useEffect(() => {
    if (!setupError) return
    const onOnline = () => {
      setupStarted.current = false
      setSetupError(null)
      setRetryTick((t) => t + 1)
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [setupError])

  useEffect(() => {
    if (!user || setupStarted.current) return
    setupStarted.current = true

    const pendingGuestId = getPendingGuestMigrationId()

    // Гість щойно ввійшов через Google — переносимо його локальні дані
    // на реальний акаунт замість звичайного first-login сетапу
    // (інакше isFirstLogin/setupFirstLogin створили б ще один порожній
    // дефолтний рахунок і категорії поверх щойно перенесених).
    if (pendingGuestId && !isGuestMode() && user.id !== pendingGuestId) {
      migrateGuestDataToAccount(pendingGuestId, user.id)
        .then(() => {
          clearPendingGuestMigration()
          setSetupDone(true)
        })
        .catch((err: unknown) => {
          setupStarted.current = false
          setSetupError(err instanceof Error ? err.message : 'Помилка перенесення гостьових даних')
        })
      return
    }

    isFirstLogin(user.id)
      .then(async (needsSetup) => {
        if (needsSetup) await setupFirstLogin(user.id)
        setSetupDone(true)
      })
      .catch((err: unknown) => {
        setupStarted.current = false // дозволяємо повторну спробу при помилці
        setSetupError(err instanceof Error ? err.message : 'Помилка ініціалізації')
      })
  }, [user, retryTick])

  if (loading) return <SplashScreen message="Завантаження..." />
  if (!user) return <Navigate to="/login" replace />

  if (!setupDone) {
    if (setupError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6">
          <p style={{ color: 'var(--color-expense)' }}>Помилка: {setupError}</p>
          <button onClick={() => window.location.reload()} style={{ color: 'var(--color-accent)' }}>
            Спробувати знову
          </button>
        </div>
      )
    }
    return <SplashScreen message="Налаштовуємо профіль..." />
  }

  // SyncProvider отримує userId і запускає SyncEngine.
  // Outlet рендерить захищений маршрут (AppLayout → екрани).
  return (
    <SyncProvider userId={user.id}>
      <Outlet />
    </SyncProvider>
  )
}

function SplashScreen({ message }: { message: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen gap-3"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
      <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{message}</p>
    </div>
  )
}
