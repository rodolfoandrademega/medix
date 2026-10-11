-- Inscrições e fila de push. Nenhuma informação clínica vai para o provedor push.
begin;
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint_hash text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  subscription jsonb not null,
  advance_minutes integer not null default 30 check (advance_minutes in (5,15,30,60)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.push_deliveries (
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  event_key text not null,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  kind text not null check (kind in ('created','upcoming')),
  appointment_starts_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0,
  retry_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (subscription_id,event_key)
);
alter table public.push_subscriptions enable row level security;
alter table public.push_deliveries enable row level security;
revoke all on public.push_subscriptions, public.push_deliveries from anon, authenticated;
grant select,insert,update,delete on public.push_subscriptions,public.push_deliveries to service_role;
create index if not exists appointments_notification_recipients_idx on public.appointments using gin(notification_recipients);
create index if not exists push_deliveries_pending_idx on public.push_deliveries(retry_at) where status in ('pending','processing');

-- Claim atômico; dois workers concorrentes não enviam o mesmo aviso.
create or replace function public.claim_push_deliveries()
returns table(subscription_id uuid,event_key text,kind text,subscription jsonb)
language plpgsql security definer set search_path=public as $$
begin
  delete from public.push_deliveries where created_at < now() - interval '7 days';
  insert into public.push_deliveries(subscription_id,event_key,appointment_id,kind,appointment_starts_at)
  select s.id,e.kind||':'||a.id::text||case when e.kind='upcoming' then ':'||extract(epoch from a.starts_at)::text else '' end,a.id,e.kind,a.starts_at
  from public.push_subscriptions s
  join public.clinic_members m on m.user_id=s.user_id and m.clinic_id=s.clinic_id
  join public.clinics c on c.id=s.clinic_id
  join public.appointments a on a.clinic_id=s.clinic_id and a.notification_recipients @> array[s.user_id]
  cross join (values ('created'),('upcoming')) e(kind)
  where c.status='active' and coalesce(c.enabled_modules->>'agenda','true')='true'
    and (m.role='owner' or m.permissions->>'agenda'='true')
    and a.status in ('scheduled','confirmed')
    and ((e.kind='created' and a.created_at > now()-interval '10 minutes' and a.created_at >= s.created_at)
      or (e.kind='upcoming' and a.starts_at > now() and a.starts_at <= now()+make_interval(mins=>s.advance_minutes)))
  on conflict do nothing;

  return query
  with ready as (
    select d.subscription_id,d.event_key from public.push_deliveries d
    join public.push_subscriptions s on s.id=d.subscription_id
    join public.clinic_members m on m.user_id=s.user_id and m.clinic_id=s.clinic_id
    join public.clinics c on c.id=s.clinic_id
    join public.appointments a on a.id=d.appointment_id and a.clinic_id=s.clinic_id
    where d.status in ('pending','processing') and d.retry_at<=now() and d.attempts<5
      and d.created_at>=s.created_at
      and c.status='active' and coalesce(c.enabled_modules->>'agenda','true')='true'
      and (m.role='owner' or m.permissions->>'agenda'='true')
      and a.notification_recipients @> array[s.user_id] and a.status in ('scheduled','confirmed')
      and ((d.kind='created' and d.created_at>now()-interval '15 minutes') or (d.kind='upcoming' and a.starts_at=d.appointment_starts_at and a.starts_at>now() and a.starts_at<=now()+make_interval(mins=>s.advance_minutes)))
    order by d.retry_at limit 20 for update of d skip locked
  ), claimed as (
    update public.push_deliveries d set status='processing',attempts=d.attempts+1,retry_at=now()+interval '2 minutes'
    from ready r where d.subscription_id=r.subscription_id and d.event_key=r.event_key
    returning d.subscription_id,d.event_key,d.kind
  )
  select q.subscription_id,q.event_key,q.kind,s.subscription from claimed q join public.push_subscriptions s on s.id=q.subscription_id;
end;
$$;
revoke all on function public.claim_push_deliveries() from public,anon,authenticated;
grant execute on function public.claim_push_deliveries() to service_role;
commit;
