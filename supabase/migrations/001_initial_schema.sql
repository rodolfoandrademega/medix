-- Medix: estrutura multi-clínica. Execute no SQL Editor do Supabase.
create extension if not exists "pgcrypto";

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz not null default now()
);

create type public.member_role as enum ('owner', 'admin', 'professional', 'receptionist');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.clinic_members (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'professional',
  primary key (clinic_id, user_id)
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  birth_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  professional_id uuid references public.profiles(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','confirmed','completed','cancelled','no_show')),
  notes text,
  created_at timestamptz not null default now()
);

-- Nunca confie apenas no filtro do frontend: cada registro só é visível a membros da própria clínica.
create or replace function public.is_clinic_member(target_clinic uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.clinic_members where clinic_id = target_clinic and user_id = auth.uid());
$$;

alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.clinic_members enable row level security;
alter table public.patients enable row level security;
alter table public.appointments enable row level security;

create policy "members view their clinic" on public.clinics for select using (public.is_clinic_member(id));
create policy "users view their profile" on public.profiles for select using (id = auth.uid());
create policy "users update their profile" on public.profiles for update using (id = auth.uid());
create policy "members view team" on public.clinic_members for select using (public.is_clinic_member(clinic_id));
create policy "members manage patients" on public.patients for all using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));
create policy "members manage appointments" on public.appointments for all using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));

create index patients_clinic_id_idx on public.patients(clinic_id);
create index appointments_clinic_starts_at_idx on public.appointments(clinic_id, starts_at);
