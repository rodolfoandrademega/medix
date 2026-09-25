-- Cadastro de pacientes: contato obrigatório e informações complementares opcionais.
alter table public.patients
  add column if not exists preferred_name text,
  add column if not exists cpf text,
  add column if not exists gender text,
  add column if not exists occupation text,
  add column if not exists address text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists neighborhood text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists referred_by text;

-- NOT VALID preserva cadastros históricos que ainda não possuam todos os dados.
-- A regra é aplicada a qualquer novo cadastro ou atualização.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'patients_new_records_require_contact'
      and conrelid = 'public.patients'::regclass
  ) then
    alter table public.patients
      add constraint patients_new_records_require_contact
      check (
        phone is not null
        and length(trim(phone)) >= 8
        and email is not null
        and position('@' in trim(email)) > 1
      ) not valid;
  end if;
end $$;

create index if not exists patients_clinic_phone_idx on public.patients(clinic_id, phone);
