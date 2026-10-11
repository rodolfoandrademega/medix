-- Execute SOMENTE após a migration 023, as variáveis da API e o secret no Vault.
-- Ative pg_cron e pg_net em Database > Extensions antes.
-- Vault: crie medix_push_cron_secret com o MESMO valor de PUSH_CRON_SECRET.
-- Não salve o valor desse secret neste arquivo, no Git ou no chat.
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
