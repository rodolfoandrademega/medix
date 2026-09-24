-- Leitura direta do workspace do usuário autenticado.
-- Evita dependência circular entre a política de clinics e a função is_clinic_member.
drop policy if exists "members view their clinic" on public.clinics;

create policy "members view their clinic"
on public.clinics
for select
using (
  exists (
    select 1 from public.clinic_members cm
    where cm.clinic_id = clinics.id
      and cm.user_id = auth.uid()
  )
);
