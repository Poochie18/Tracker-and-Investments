-- ============================================================
-- Міграція 010: SQL-обгортки для Vault
-- Запусти цей SQL у Supabase Dashboard → SQL Editor.
--
-- vault.create_secret / vault.delete_secret / vault.decrypted_secrets
-- лежать у схемі "vault", яку PostgREST (а отже supabase-js .rpc()/.from()
-- з Edge Function) НЕ бачить — він працює лише зі схемою "public".
-- Тому робимо тонкі SECURITY DEFINER-обгортки в public, і забороняємо
-- виконання всім, крім service_role (щоб anon/authenticated точно не
-- могли прочитати/створити чужий секрет напряму через REST API).
-- ============================================================

CREATE OR REPLACE FUNCTION public.vault_create_secret(secret TEXT, secret_name TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN vault.create_secret(secret, secret_name);
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_delete_secret(secret_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM vault.delete_secret(secret_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_read_secret(secret_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT decrypted_secret INTO result FROM vault.decrypted_secrets WHERE id = secret_id;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.vault_create_secret(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vault_delete_secret(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vault_read_secret(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.vault_create_secret(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_delete_secret(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_read_secret(UUID) TO service_role;
