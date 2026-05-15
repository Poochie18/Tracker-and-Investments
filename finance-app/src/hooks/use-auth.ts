import { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { authClient } from '@/lib/auth/auth-client'

export interface UseAuthReturn {
  user: User | null
  loading: boolean  // true поки Supabase перевіряє збережену сесію
  signOut: () => Promise<void>
}

// useAuth — підписується на стан авторизації і повертає поточного юзера.
// Використовуй цей хук скрізь де треба знати хто увійшов.
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Одразу отримуємо поточну сесію з localStorage (без мережевого запиту)
    authClient.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    // Підписуємось на всі зміни: SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED тощо
    const {
      data: { subscription },
    } = authClient.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Cleanup: відписуємось при розмонтуванні компонента
    return () => subscription.unsubscribe()
  }, [])

  const signOut = useCallback(async () => {
    await authClient.signOut()
  }, [])

  return { user, loading, signOut }
}
