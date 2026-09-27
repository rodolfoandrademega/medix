-- Alertas individuais e edição completa de acessos da equipe.
alter table public.clinic_members
  add column if not exists admin_alert_title text,
  add column if not exists admin_alert_message text,
  add column if not exists admin_alert_level text not null default 'info'
    check (admin_alert_level in ('info', 'warning', 'important'));

drop function if exists public.current_workspace();
create function public.current_workspace()
returns table(clinic_id uuid,clinic_name text,clinic_status public.clinic_status,member_role public.member_role,enabled_modules jsonb,member_permissions jsonb,admin_alert_title text,admin_alert_message text,admin_alert_level text,member_alert_title text,member_alert_message text,member_alert_level text,refresh_requested_at timestamptz)
language sql stable security definer set search_path=public as $$
 select c.id,c.name,c.status,cm.role,c.enabled_modules,cm.permissions,
   c.admin_alert_title,c.admin_alert_message,c.admin_alert_level,
   cm.admin_alert_title,cm.admin_alert_message,cm.admin_alert_level,s.refresh_requested_at
 from public.clinic_members cm
 join public.clinics c on c.id=cm.clinic_id
 cross join public.platform_settings s
 where cm.user_id=auth.uid() order by c.created_at limit 1;
$$;

drop function if exists public.list_clinic_access();
create function public.list_clinic_access()
returns table(invite_id uuid,user_id uuid,full_name text,email text,member_role public.member_role,permissions jsonb,status text,created_at timestamptz,admin_alert_title text,admin_alert_message text,admin_alert_level text)
language sql stable security definer set search_path=public as $$
 select null::uuid,cm.user_id,coalesce(p.full_name,''),u.email,cm.role,cm.permissions,'active',p.created_at,cm.admin_alert_title,cm.admin_alert_message,cm.admin_alert_level
 from public.clinic_members cm join public.profiles p on p.id=cm.user_id join auth.users u on u.id=cm.user_id
 where cm.clinic_id=public.current_primary_clinic_id() and exists(select 1 from public.clinic_members me where me.clinic_id=cm.clinic_id and me.user_id=auth.uid() and me.role='owner')
 union all
 select ci.id,null::uuid,'',ci.email,ci.role,ci.permissions,ci.status::text,ci.created_at,null::text,null::text,'info'::text
 from public.clinic_invites ci where ci.clinic_id=public.current_primary_clinic_id() and ci.status='pending' and exists(select 1 from public.clinic_members me where me.clinic_id=ci.clinic_id and me.user_id=auth.uid() and me.role='owner');
$$;

drop function if exists public.update_clinic_member_access(uuid, public.member_role, jsonb);
create function public.update_clinic_member_access(target_user uuid,target_role public.member_role,target_permissions jsonb,target_alert_title text default null,target_alert_message text default null,target_alert_level text default 'info')
returns void language plpgsql security definer set search_path=public as $$
declare cid uuid:=public.current_primary_clinic_id(); begin
 if not exists(select 1 from public.clinic_members where clinic_id=cid and user_id=auth.uid() and role='owner') then raise exception 'Sem permissão.'; end if;
 if target_user=auth.uid() then raise exception 'Não altere seu próprio acesso por esta tela.'; end if;
 if target_role='owner' then raise exception 'Não é permitido atribuir a função de proprietário por esta tela.'; end if;
 if target_alert_level not in ('info','warning','important') then raise exception 'Prioridade de alerta inválida.'; end if;
 update public.clinic_members set role=target_role,permissions=target_permissions,admin_alert_title=nullif(trim(target_alert_title),''),admin_alert_message=nullif(trim(target_alert_message),''),admin_alert_level=target_alert_level where clinic_id=cid and user_id=target_user;
end; $$;

grant execute on function public.current_workspace(),public.list_clinic_access(),public.update_clinic_member_access(uuid,public.member_role,jsonb,text,text,text) to authenticated;
