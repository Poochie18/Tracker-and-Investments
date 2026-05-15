import { supabase } from '@/lib/supabase'

// Обгортка над Supabase Auth — єдине місце де ми звертаємось до auth API.
// Компоненти не повинні імпортувати supabase.auth напряму.
export const authClient = {
  // Запускає Google OAuth. Supabase перенаправить на Google,
  // потім Google поверне на /auth/callback з кодом авторизації.
  signInWithGoogle: () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    }),

  signOut: () => supabase.auth.signOut(),

  getSession: () => supabase.auth.getSession(),

  // Підписка на зміни стану авторизації (логін / логаут / оновлення токена).
  // Повертає функцію для відписки — викликай у cleanup useEffect.
  onAuthStateChange: (
    callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]
  ) => supabase.auth.onAuthStateChange(callback),
}
