import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { authClient } from '@/lib/auth/auth-client'
import { disableGuestMode, isGuestMode, markPendingGuestMigration } from '@/lib/auth/local-mode'

// AuthCallback — сторінка на яку Google повертає після авторизації.
// URL виглядає як: /auth/callback?code=xxx
// Supabase з PKCE flow сам обробляє code exchange при першому getSession().
export function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    // Supabase слухає URL і автоматично обмінює code на session.
    // Підписуємось на подію SIGNED_IN — вона спрацює одразу після exchange.
    const {
      data: { subscription },
    } = authClient.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Запобіжник: якщо прапорець "гість" лишився увімкненим (напр. після
        // прямого входу через Google, минаючи кнопку "Створити акаунт" —
        // або якщо він застряг через збій навігації) — реальна сесія вже є,
        // тож знімаємо гостьовий режим і позначаємо гостьові дані на
        // перенесення, щоб AuthGuard їх підхопив, а не залишив "осиротілими".
        if (isGuestMode()) {
          markPendingGuestMigration()
          disableGuestMode()
        }
        navigate('/overview', { replace: true })
      } else if (event === 'SIGNED_OUT') {
        navigate('/login', { replace: true })
      }
    })

    // Fallback: якщо через 8 секунд нічого не сталось — щось пішло не так
    const fallbackTimer = setTimeout(() => {
      navigate('/login', { replace: true })
    }, 8000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(fallbackTimer)
    }
  }, [navigate])

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen gap-3"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
      <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Авторизуємось через Google...
      </p>
    </div>
  )
}
