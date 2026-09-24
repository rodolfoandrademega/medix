-- O dashboard trabalha com um workspace principal por usuário.
-- Evita erro de maybeSingle quando existirem clínicas de teste anteriores.
create or replace function public.current_primary_clinic_id()
returns uuid language sql stable security definer set search_path=public as $$
  select clinic_id
  from public.clinic_members
  where user_id = auth.uid()
  order by clinic_id
  limit 1;
$$;

drop policy if exists "users view own membership" on public.clinic_members;
drop policy if exists "members view team" on public.clinic_members;

create policy "users view primary membership"
on public.clinic_members for select
using (user_id = auth.uid() and clinic_id = public.current_primary_clinic_id());

grant execute on function public.current_primary_clinic_id() to authenticated;
