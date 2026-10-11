-- Destinatários internos de avisos da agenda. Sem envio para pessoas externas.
begin;
alter table public.appointments
  add column if not exists notification_recipients uuid[] not null default '{}'::uuid[];
-- A API autentica a sessão, valida a clínica, a agenda e cada destinatário.
grant select, insert, update on public.appointments to service_role;
grant select on public.procedures to service_role;
commit;
