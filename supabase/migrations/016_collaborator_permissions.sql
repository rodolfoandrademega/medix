-- Acessos individuais da equipe por módulo clínico.
alter table public.clinic_members add column if not exists permissions jsonb not null default
  '{"patients":true,"anamnesis":true,"records":true,"history":true,"agenda":true,"procedures":true,"team":false,"financial":false,"reports":false}'::jsonb;
alter table public.clinic_invites add column if not exists permissions jsonb not null default
  '{"patients":true,"anamnesis":false,"records":false,"history":true,"agenda":true,"procedures":false,"team":false,"financial":false,"reports":false}'::jsonb;

update public.clinic_members
set permissions = '{"patients":true,"anamnesis":true,"records":true,"history":true,"agenda":true,"procedures":true,"team":true,"financial":true,"reports":true}'::jsonb
where role = 'owner';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', '')) on conflict (id) do nothing;
  insert into public.clinic_members(clinic_id,user_id,role,permissions)
  select clinic_id,new.id,role,permissions from public.clinic_invites where lower(email)=lower(new.email) and status='pending'
  on conflict(clinic_id,user_id) do update set role=excluded.role,permissions=excluded.permissions;
  update public.clinic_invites set status='accepted' where lower(email)=lower(new.email) and status='pending';
  return new;
end; $$;

drop function if exists public.current_workspace();
create function public.current_workspace()
returns table(clinic_id uuid,clinic_name text,clinic_status public.clinic_status,member_role public.member_role,enabled_modules jsonb,member_permissions jsonb,admin_alert_title text,admin_alert_message text,admin_alert_level text,refresh_requested_at timestamptz)
language sql stable security definer set search_path=public as $$
 select c.id,c.name,c.status,cm.role,c.enabled_modules,cm.permissions,c.admin_alert_title,c.admin_alert_message,c.admin_alert_level,s.refresh_requested_at
 from public.clinic_members cm join public.clinics c on c.id=cm.clinic_id cross join public.platform_settings s
 where cm.user_id=auth.uid() order by c.created_at limit 1;
$$;

create or replace function public.list_clinic_access()
returns table(invite_id uuid,user_id uuid,full_name text,email text,member_role public.member_role,permissions jsonb,status text,created_at timestamptz)
language sql stable security definer set search_path=public as $$
 select null::uuid,cm.user_id,coalesce(p.full_name,''),u.email,cm.role,cm.permissions,'active',p.created_at
 from public.clinic_members cm join public.profiles p on p.id=cm.user_id join auth.users u on u.id=cm.user_id
 where cm.clinic_id=public.current_primary_clinic_id() and exists(select 1 from public.clinic_members me where me.clinic_id=cm.clinic_id and me.user_id=auth.uid() and me.role='owner')
 union all
 select ci.id,null::uuid,'',ci.email,ci.role,ci.permissions,ci.status::text,ci.created_at
 from public.clinic_invites ci where ci.clinic_id=public.current_primary_clinic_id() and ci.status='pending' and exists(select 1 from public.clinic_members me where me.clinic_id=ci.clinic_id and me.user_id=auth.uid() and me.role='owner');
$$;

create or replace function public.invite_clinic_member(invited_email text, invited_role public.member_role, invited_permissions jsonb)
returns text language plpgsql security definer set search_path=public as $$
declare cid uuid:=public.current_primary_clinic_id(); uid uuid;
begin
 if cid is null or not exists(select 1 from public.clinic_members where clinic_id=cid and user_id=auth.uid() and role='owner') then raise exception 'Apenas o proprietário pode administrar colaboradores.'; end if;
 select id into uid from auth.users where lower(email)=lower(trim(invited_email));
 if uid is not null then
  insert into public.clinic_members(clinic_id,user_id,role,permissions) values(cid,uid,invited_role,invited_permissions) on conflict(clinic_id,user_id) do update set role=excluded.role,permissions=excluded.permissions;
  return 'Acesso liberado para o colaborador.';
 end if;
 insert into public.clinic_invites(clinic_id,email,role,permissions,invited_by,status) values(cid,lower(trim(invited_email)),invited_role,invited_permissions,auth.uid(),'pending') on conflict(clinic_id,email) do update set role=excluded.role,permissions=excluded.permissions,status='pending';
 return 'Convite salvo. O acesso será liberado quando esta pessoa criar a conta com este e-mail.';
end; $$;

create or replace function public.update_clinic_member_access(target_user uuid,target_role public.member_role,target_permissions jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare cid uuid:=public.current_primary_clinic_id(); begin
 if not exists(select 1 from public.clinic_members where clinic_id=cid and user_id=auth.uid() and role='owner') then raise exception 'Sem permissão.'; end if;
 if target_user=auth.uid() then raise exception 'Não altere seu próprio acesso por esta tela.'; end if;
 update public.clinic_members set role=target_role,permissions=target_permissions where clinic_id=cid and user_id=target_user;
end; $$;

grant execute on function public.current_workspace(),public.list_clinic_access(),public.invite_clinic_member(text,public.member_role,jsonb),public.update_clinic_member_access(uuid,public.member_role,jsonb) to authenticated;
