import { useState } from 'react'
import { Wallet } from 'lucide-react'
import { authClient } from '@/lib/auth/auth-client'

export function LoginScreen() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError(null)

    const { error } = await authClient.signInWithGoogle()

    if (error) {
      // signInWithGoogle зазвичай не повертає помилку синхронно —
      // вона перенаправляє браузер. Якщо помилка є — щось пішло не так.
      setError(error.message)
      setLoading(false)
    }
    // При успіху — браузер перейде на Google, повернеться на /auth/callback
  }

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen gap-10 px-6"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
      {/* Логотип */}
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-bg-header)' }}
        >
          <Wallet size={44} color="var(--color-accent)" />
        </div>
        <div className="text-center">
          <h1
            className="text-2xl font-semibold mb-1"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Мої фінанси
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Особистий облік доходів і витрат
          </p>
        </div>
      </div>

      {/* Блок авторизації */}
      <div className="flex flex-col items-center gap-4 w-full max-w-xs">
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="flex items-center justify-center gap-3 w-full py-3.5 px-6 rounded-2xl font-medium transition-opacity active:opacity-80 disabled:opacity-60"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: '#1B2A2A',
          }}
        >
          {/* Логотип Google (SVG, щоб не залежати від шрифту) */}
          <GoogleIcon />
          {loading ? 'Перенаправляємо...' : 'Увійти через Google'}
        </button>

        {error && (
          <p className="text-sm text-center" style={{ color: 'var(--color-expense)' }}>
            {error}
          </p>
        )}

        <p className="text-xs text-center" style={{ color: 'var(--color-text-secondary)' }}>
          Ваші дані зберігаються тільки на вашому акаунті і захищені Google OAuth
        </p>
      </div>
    </div>
  )
}

// Простий SVG логотип Google
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#1B2A2A"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#1B2A2A"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#1B2A2A"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#1B2A2A"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  )
}
