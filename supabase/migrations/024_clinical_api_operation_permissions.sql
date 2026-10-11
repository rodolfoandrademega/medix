-- Corrige privilégios faltantes da API; não libera acesso ao navegador.
-- Publique primeiro a API com validação de módulos/permissões individuais.
begin;
grant usage on schema public to service_role;
grant select on public.clinic_invites to service_role;
grant select,insert,update,delete on public.patients,public.procedures to service_role;
grant select,insert,update on public.patient_anamnesis to service_role;
grant select,insert on public.patient_clinical_records to service_role;
-- Não altera anon/authenticated, RLS nem registros existentes.
commit;
