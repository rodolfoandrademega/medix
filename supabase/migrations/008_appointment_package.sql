-- Um agendamento pode usar um procedimento avulso ou uma sessão de combo/pacote.
alter table public.appointments
  add column package_id uuid references public.service_packages(id) on delete set null,
  add constraint appointment_service_source check (
    not (procedure_id is not null and package_id is not null)
  );

create index appointments_package_id_idx on public.appointments(package_id);
