-- A API vincula colaboradores à clínica selecionada e validada no servidor.
-- Complementa os grants de leitura/inserção da migration 020.
begin;

grant update (role, permissions, admin_alert_title, admin_alert_message, admin_alert_level)
on public.clinic_members to service_role;

commit;
