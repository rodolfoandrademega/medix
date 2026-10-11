-- Privilégios SQL necessários ao cadastro de clínicas pela API.
-- service_role ignora RLS, mas ainda precisa de grants nas tabelas.
-- A API verifica a sessão e determina user_id no servidor.
-- Não altera políticas RLS nem libera acesso a anon/authenticated.
begin;

grant usage on schema public to service_role;
grant select, insert on public.profiles, public.clinics, public.clinic_members
to service_role;
grant select on public.platform_settings to service_role;

commit;
