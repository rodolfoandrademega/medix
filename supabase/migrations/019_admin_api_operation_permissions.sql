-- Permissões usadas pelas operações administrativas já existentes na API.
-- A API valida sessão e platform_admins antes de executar cada operação.
-- Nenhuma permissão é concedida a anon/authenticated; as políticas RLS permanecem.
begin;

grant update (
  name, plan_name, status, status_updated_at, enabled_modules,
  admin_alert_title, admin_alert_message, admin_alert_level
) on public.clinics to service_role;

grant delete on public.clinics to service_role;

grant select on public.patients, public.appointments, public.platform_settings
to service_role;

grant update (refresh_requested_at, updated_at)
on public.platform_settings to service_role;

commit;
