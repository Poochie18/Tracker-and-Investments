import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Під час збірки перевіряємо наявність змінних оточення.
// anon key — це публічний ключ, його безпечно зберігати у клієнтському коді.
// НІКОЛИ не використовуй service_role key на фронтенді!
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_URL або VITE_SUPABASE_ANON_KEY не задані.\n' +
      'Скопіюй .env.example → .env і заповни ключами з Supabase Dashboard.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // PKCE (Proof Key for Code Exchange) — безпечніший OAuth flow для SPA.
    // Supabase автоматично обробляє code exchange при redirect назад в додаток.
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
  },
})
