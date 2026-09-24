-- Permissões de base para usuários logados. As políticas RLS continuam
-- definindo quais linhas cada usuário realmente pode acessar.
grant usage on schema public to authenticated;

grant select on public.clinics, public.profiles, public.clinic_members to authenticated;
grant select, insert, update, delete on public.patients, public.appointments to authenticated;
grant update on public.profiles to authenticated;

-- A criação de clínicas e vínculos ocorre exclusivamente pela função segura.
grant execute on function public.create_clinic_with_owner(text, text) to authenticated;
