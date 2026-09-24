-- Catálogo clínico e detalhes dos agendamentos.
create table public.procedures (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 480),
  price numeric(12,2) check (price is null or price >= 0),
  color text not null default '#7155e8',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id, name)
);

alter table public.appointments
  add column procedure_id uuid references public.procedures(id) on delete set null,
  add column duration_minutes integer not null default 30 check (duration_minutes between 5 and 480),
  add column internal_notes text,
  add column patient_notes text;

alter table public.procedures enable row level security;
create policy "members manage procedures" on public.procedures
for all using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));
grant select, insert, update, delete on public.procedures to authenticated;
create index procedures_clinic_active_idx on public.procedures(clinic_id, active);
create index appointments_clinic_period_idx on public.appointments(clinic_id, starts_at, ends_at);
