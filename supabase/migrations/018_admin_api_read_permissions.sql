-- A API verifica o super admin e lê o console com a credencial service_role.
-- BYPASSRLS não substitui os privilégios SQL das tabelas.
-- Esta migration libera somente as leituras necessárias para abrir o console.
-- Não concede permissões aos papéis anon/authenticated nem altera as políticas RLS.
begin;

grant select on public.platform_admins, public.profiles, public.clinics
to service_role;

commit;
