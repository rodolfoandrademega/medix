-- Permite que o usuário autenticado leia a sua própria associação de clínica.
-- Sem isso, o dashboard não consegue identificar o workspace logo após o onboarding.
create policy "users view own membership"
on public.clinic_members
for select
using (user_id = auth.uid());
