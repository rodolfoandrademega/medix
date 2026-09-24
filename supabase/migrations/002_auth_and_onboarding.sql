-- Cria automaticamente o perfil público quando um usuário se cadastra no Supabase Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Único caminho de abertura de uma clínica: cria a unidade e associa o usuário atual como owner.
-- A função roda no banco, evitando que alguém crie registros em nome de outra clínica.
create or replace function public.create_clinic_with_owner(clinic_name text, clinic_slug text)
returns public.clinics language plpgsql security definer set search_path = public as $$
declare
  new_clinic public.clinics;
begin
  if auth.uid() is null then
    raise exception 'Você precisa estar autenticado para criar uma clínica.';
  end if;

  if clinic_name is null or length(trim(clinic_name)) < 2 then
    raise exception 'Informe um nome de clínica válido.';
  end if;

  if clinic_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Use um identificador com letras minúsculas, números e hífens.';
  end if;

  insert into public.clinics (name, slug)
  values (trim(clinic_name), clinic_slug)
  returning * into new_clinic;

  insert into public.clinic_members (clinic_id, user_id, role)
  values (new_clinic.id, auth.uid(), 'owner');

  return new_clinic;
end;
$$;

grant execute on function public.create_clinic_with_owner(text, text) to authenticated;
