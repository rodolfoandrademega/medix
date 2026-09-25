-- Ficha de anamnese única por paciente e evoluções do prontuário.
create table if not exists public.patient_anamnesis (
  patient_id uuid primary key references public.patients(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  main_complaint text,
  allergies text,
  current_medications text,
  medical_conditions text,
  previous_surgeries text,
  family_history text,
  lifestyle_notes text,
  clinical_observations text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patient_clinical_records (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  title text not null default 'Evolução clínica',
  content text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.patient_anamnesis enable row level security;
alter table public.patient_clinical_records enable row level security;

create policy "members manage patient anamnesis" on public.patient_anamnesis
for all using (public.is_clinic_member(clinic_id))
with check (public.is_clinic_member(clinic_id));

create policy "members manage patient clinical records" on public.patient_clinical_records
for all using (public.is_clinic_member(clinic_id))
with check (public.is_clinic_member(clinic_id));

grant select, insert, update, delete on public.patient_anamnesis, public.patient_clinical_records to authenticated;

create index if not exists patient_clinical_records_patient_date_idx
on public.patient_clinical_records(patient_id, occurred_at desc);
