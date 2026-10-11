-- Execute após a migration 023. Não precisa copiar ou informar nenhuma chave.
-- Este script cria o secret diretamente no Vault e prepara o job.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $$
begin
  if not exists (select 1 from vault.secrets where name='medix_push_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'medix_push_cron_secret','Assinatura restrita do job de push Medix');
  end if;
end;
$$;

-- Somente o backend pode obter o secret específico para cadastrá-lo na Vercel.
-- Nenhum acesso para anon/authenticated nem acesso a outros secrets do Vault.
create or replace function public.medix_push_setup_secret()
returns text language sql security definer set search_path=public as $$
  select decrypted_secret from vault.decrypted_secrets where name='medix_push_cron_secret' limit 1;
$$;
revoke all on function public.medix_push_setup_secret() from public,anon,authenticated;
grant execute on function public.medix_push_setup_secret() to service_role;
create or replace function public.dispatch_medix_push()
returns void language plpgsql security definer
set search_path=public,extensions,pg_catalog as $$
declare
  signing_secret text;
  stamp text := floor(extract(epoch from clock_timestamp()))::bigint::text;
  signature text;
begin
  select decrypted_secret into signing_secret from vault.decrypted_secrets
  where name='medix_push_cron_secret' limit 1;
  if signing_secret is null then raise exception 'Configure medix_push_cron_secret no Vault.'; end if;
  -- pg_net pode expor headers aos papéis do banco. Por isso, NÃO envia segredo
  -- permanente nem service_role: apenas assinatura de escopo único válida por 90s.
  signature := encode(hmac('medix-push:'||stamp,signing_secret,'sha256'),'hex');
  perform net.http_post(
    url := 'https://medix-api.vercel.app/api/internal/push/dispatch',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||stamp||'.'||signature),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
end;
$$;
revoke all on function public.dispatch_medix_push() from public,anon,authenticated;
select cron.schedule('medix-push-every-minute','* * * * *','select public.dispatch_medix_push();');
