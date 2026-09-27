-- Controles operacionais da plataforma: módulos, alertas, atualização e backup.
alter table public.clinics
  add column if not exists enabled_modules jsonb not null default
    '{"overview": true, "agenda": true, "patients": true, "team": true, "financial": true, "reports": true}'::jsonb,
  add column if not exists admin_alert_title text,
  add column if not exists admin_alert_message text,
  add column if not exists admin_alert_level text not null default 'info'
    check (admin_alert_level in ('info', 'warning', 'important'));

create table if not exists public.platform_settings (
  singleton boolean primary key default true check (singleton),
  refresh_requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists "platform admins manage settings" on public.platform_settings;
create policy "platform admins manage settings" on public.platform_settings
for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Recria a RPC com as configurações que a clínica precisa receber no login.
drop function if exists public.current_workspace();
create function public.current_workspace()
returns table(
  clinic_id uuid,
  clinic_name text,
  clinic_status public.clinic_status,
  member_role public.member_role,
  enabled_modules jsonb,
  admin_alert_title text,
  admin_alert_message text,
  admin_alert_level text,
  refresh_requested_at timestamptz
)
language sql stable security definer set search_path=public as $$
  select c.id, c.name, c.status, cm.role, c.enabled_modules,
    c.admin_alert_title, c.admin_alert_message, c.admin_alert_level,
    settings.refresh_requested_at
  from public.clinic_members cm
  join public.clinics c on c.id = cm.clinic_id
  cross join public.platform_settings settings
  where cm.user_id = auth.uid()
  order by c.created_at
  limit 1;
$$;

-- Exclusão é permitida somente para a administração da plataforma.
drop policy if exists "platform admins delete clinics" on public.clinics;
create policy "platform admins delete clinics" on public.clinics
for delete using (public.is_platform_admin());

-- Backup exportável pelo super admin. Dados clínicos nunca ficam expostos a membros comuns.
create or replace function public.export_clinic_backup(target_clinic uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  payload jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Apenas administradores da plataforma podem exportar backups.';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'clinic', to_jsonb(c),
    'patients', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at) from public.patients p where p.clinic_id = c.id), '[]'::jsonb),
    'appointments', coalesce((select jsonb_agg(to_jsonb(a) order by a.starts_at) from public.appointments a where a.clinic_id = c.id), '[]'::jsonb)
  ) into payload
  from public.clinics c
  where c.id = target_clinic;

  if payload is null then
    raise exception 'Clínica não encontrada.';
  end if;
  return payload;
end;
$$;

grant select, update on public.platform_settings to authenticated;
grant delete on public.clinics to authenticated;
grant execute on function public.current_workspace() to authenticated;
grant execute on function public.export_clinic_backup(uuid) to authenticated;
