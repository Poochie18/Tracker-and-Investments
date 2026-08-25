import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// Два клієнти:
// - "user" клієнт — з JWT викликача, тільки щоб дізнатись user.id (auth.getUser).
//   RLS все одно застосовується для будь-яких запитів через нього.
// - "admin" клієнт — service_role, обходить RLS. Використовується лише
//   для читання/запису credentials і розшифровки vault.decrypted_secrets —
//   ніколи не повертається й не логується назовні цілком.
export function getServiceRoleClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } })
}

// Дістає user.id з Authorization-заголовка запиту (Supabase JWT анонімного
// клієнта). Кидає, якщо токен відсутній/невалідний — викликач ловить і
// повертає 401.
export async function getUserIdFromRequest(req: Request): Promise<string> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new Error('Немає Authorization заголовка')

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })

  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('Невалідний токен користувача')
  return data.user.id
}
