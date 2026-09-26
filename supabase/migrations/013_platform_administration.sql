-- Administração da plataforma Medix. Não armazena nenhum e-mail pessoal no repositório.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'clinic_status') then
    create type public.clinic_status as enum ('pending', 'active', 'suspended', 'inactive');
  end if;
end $$;

-- Clínicas existentes entram como ativas; somente as futuras começam pendentes.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clinics' and column_name = 'status'
  ) then
    alter table public.clinics
      add column status public.clinic_status not null default 'active';
    alter table public.clinics
      alter column status set default 'pending';
  end if;
end $$;

alter table public.clinics
  add column if not exists plan_name text not null default 'Essencial',
  add column if not exists status_updated_at timestamptz not null default now();

create table if not exists public.platform_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

-- O painel usa esta função para descobrir o workspace do usuário, mesmo se estiver pendente.
create or replace function public.current_workspace()
returns table(clinic_id uuid, clinic_name text, clinic_status public.clinic_status, member_role public.member_role)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.status, cm.role
  from public.clinic_members cm
  join public.clinics c on c.id = cm.clinic_id
  where cm.user_id = auth.uid()
  order by c.created_at
  limit 1;
$$;

-- Uma clínica suspensa/inativa deixa de dar acesso aos seus dados.
create or replace function public.is_clinic_member(target_clinic uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.clinic_members cm
    join public.clinics c on c.id = cm.clinic_id
    where cm.clinic_id = target_clinic
      and cm.user_id = auth.uid()
      and c.status = 'active'
  );
$$;

drop policy if exists "platform admins view themselves" on public.platform_admins;
drop policy if exists "platform admins view clinics" on public.clinics;
drop policy if exists "platform admins update clinics" on public.clinics;
drop policy if exists "platform admins view members" on public.clinic_members;
drop policy if exists "platform admins view profiles" on public.profiles;

create policy "platform admins view themselves" on public.platform_admins
for select using (user_id = auth.uid());

create policy "platform admins view clinics" on public.clinics
for select using (public.is_platform_admin());

create policy "platform admins update clinics" on public.clinics
for update using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy "platform admins view members" on public.clinic_members
for select using (public.is_platform_admin());

create policy "platform admins view profiles" on public.profiles
for select using (public.is_platform_admin());

grant select, update on public.clinics to authenticated;
grant select on public.platform_admins to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.current_workspace() to authenticated;
