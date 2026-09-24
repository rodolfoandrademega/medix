-- Módulos operacionais: financeiro e convites de colaboradores.
create type public.transaction_kind as enum ('income', 'expense');
create type public.invite_status as enum ('pending', 'accepted', 'cancelled');

create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  kind public.transaction_kind not null,
  occurred_on date not null default current_date,
  category text,
  created_at timestamptz not null default now()
);

create table public.clinic_invites (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  email text not null,
  role public.member_role not null default 'professional',
  status public.invite_status not null default 'pending',
  invited_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (clinic_id, email)
);

alter table public.financial_transactions enable row level security;
alter table public.clinic_invites enable row level security;

create policy "members manage financial transactions" on public.financial_transactions
for all using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));

create policy "members view invites" on public.clinic_invites
for select using (public.is_clinic_member(clinic_id));

create policy "owners manage invites" on public.clinic_invites
for all using (exists(select 1 from public.clinic_members where clinic_id = clinic_invites.clinic_id and user_id = auth.uid() and role in ('owner','admin')))
with check (exists(select 1 from public.clinic_members where clinic_id = clinic_invites.clinic_id and user_id = auth.uid() and role in ('owner','admin')));

grant select, insert, update, delete on public.financial_transactions, public.clinic_invites to authenticated;
create index financial_transactions_clinic_date_idx on public.financial_transactions(clinic_id, occurred_on desc);
