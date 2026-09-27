-- Informações comerciais e operacionais do catálogo de procedimentos.
alter table public.procedures
  add column if not exists category text,
  add column if not exists description text,
  add column if not exists internal_code text;

alter table public.clinics
  alter column enabled_modules set default
    '{"overview": true, "agenda": true, "patients": true, "procedures": true, "team": true, "financial": true, "reports": true}'::jsonb;

create unique index if not exists procedures_clinic_internal_code_unique_idx
on public.procedures(clinic_id, internal_code)
where internal_code is not null;

-- Clínicas atuais recebem o novo módulo habilitado; a configuração de cada clínica
-- continua podendo ser alterada pelo super admin.
update public.clinics
set enabled_modules = jsonb_set(coalesce(enabled_modules, '{}'::jsonb), '{procedures}', 'true'::jsonb, true)
where not (coalesce(enabled_modules, '{}'::jsonb) ? 'procedures');
