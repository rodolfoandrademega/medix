-- Combos/pacotes comerciais e permissões por função.
create table public.service_packages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  sessions integer not null default 1 check (sessions > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(clinic_id, name)
);
alter table public.service_packages enable row level security;
create policy "owners manage packages" on public.service_packages for all
using (exists(select 1 from public.clinic_members where clinic_id=service_packages.clinic_id and user_id=auth.uid() and role='owner'))
with check (exists(select 1 from public.clinic_members where clinic_id=service_packages.clinic_id and user_id=auth.uid() and role='owner'));
create policy "clinic members view packages" on public.service_packages for select using (public.is_clinic_member(clinic_id));
grant select,insert,update,delete on public.service_packages to authenticated;

-- Função de disponibilidade: profissionais veem horários ocupados, sem nome do paciente ou dados clínicos.
create or replace function public.get_schedule_availability(target_clinic uuid, start_period timestamptz, end_period timestamptz)
returns table(starts_at timestamptz, ends_at timestamptz, status text)
language sql stable security definer set search_path=public as $$
  select a.starts_at, a.ends_at, a.status
  from public.appointments a
  where a.clinic_id=target_clinic and a.starts_at >= start_period and a.starts_at <= end_period
    and public.is_clinic_member(target_clinic);
$$;
grant execute on function public.get_schedule_availability(uuid,timestamptz,timestamptz) to authenticated;

-- Substitui a regra aberta de agendamentos por regras de menor privilégio.
drop policy if exists "members manage appointments" on public.appointments;
create policy "owners and admins manage all appointments" on public.appointments for all
using (exists(select 1 from public.clinic_members where clinic_id=appointments.clinic_id and user_id=auth.uid() and role in ('owner','admin')))
with check (exists(select 1 from public.clinic_members where clinic_id=appointments.clinic_id and user_id=auth.uid() and role in ('owner','admin')));
create policy "professionals manage own appointments" on public.appointments for all
using (professional_id=auth.uid()) with check (professional_id=auth.uid() and public.is_clinic_member(clinic_id));

-- Gerentes não administram equipe, financeiro, catálogo ou pacotes: somente o owner faz isso.
drop policy if exists "owners manage invites" on public.clinic_invites;
create policy "owners manage invites" on public.clinic_invites for all
using (exists(select 1 from public.clinic_members where clinic_id=clinic_invites.clinic_id and user_id=auth.uid() and role='owner'))
with check (exists(select 1 from public.clinic_members where clinic_id=clinic_invites.clinic_id and user_id=auth.uid() and role='owner'));

drop policy if exists "members manage financial transactions" on public.financial_transactions;
create policy "owners manage financial transactions" on public.financial_transactions for all
using (exists(select 1 from public.clinic_members where clinic_id=financial_transactions.clinic_id and user_id=auth.uid() and role='owner'))
with check (exists(select 1 from public.clinic_members where clinic_id=financial_transactions.clinic_id and user_id=auth.uid() and role='owner'));

drop policy if exists "members manage procedures" on public.procedures;
create policy "owners manage procedures" on public.procedures for all
using (exists(select 1 from public.clinic_members where clinic_id=procedures.clinic_id and user_id=auth.uid() and role='owner'))
with check (exists(select 1 from public.clinic_members where clinic_id=procedures.clinic_id and user_id=auth.uid() and role='owner'));
create policy "members view procedures" on public.procedures for select using (public.is_clinic_member(clinic_id));
