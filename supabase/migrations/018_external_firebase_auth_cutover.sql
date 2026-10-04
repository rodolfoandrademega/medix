-- CORTE PARA FIREBASE AUTH.
-- Não execute antes de importar os usuários para o Firebase com os mesmos UUIDs
-- e publicar frontend/backend configurados com AUTH_PROVIDER=firebase.
begin;

drop trigger if exists on_auth_user_created on auth.users;

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

-- Depois do corte, todo acesso aos dados passa pelo Cloud Run com service_role.
-- O browser deixa de possuir uma chave Supabase e não acessa tabelas diretamente.
revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated;

commit;
