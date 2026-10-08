# Publicação da Medix — Supabase + Vercel

Esta é a arquitetura oficial do projeto:

```text
apps/web (Vercel) -> apps/api (Vercel Functions) -> Supabase
        |                                          |- Auth
        +------------------------------------------|- PostgreSQL
```

São dois projetos na Vercel apontando para o mesmo repositório GitHub. Isso mantém
frontend e backend separados sem depender de Google Cloud ou Firebase.

## 1. Supabase

Em **Settings > API Keys**, copie:

- Project URL;
- Publishable key (`sb_publishable_...`), usada somente no frontend;
- Secret key (`sb_secret_...`), usada somente no projeto de API da Vercel.

Se o projeto ainda não oferecer as chaves novas, use temporariamente `anon` no
frontend e `service_role` na API.

Não execute `001_initial_schema.sql` novamente em um banco que já está em produção.
Não execute nenhuma migration de corte para Firebase.

Em **Authentication > URL Configuration**, configure:

```text
Site URL: https://SEU-FRONT.vercel.app
Redirect URLs: https://SEU-FRONT.vercel.app/**
```

## 2. Projeto da API na Vercel

1. Importe o repositório GitHub na Vercel.
2. Nome sugerido: `medix-api`.
3. Em **Root Directory**, selecione `apps/api`.
4. Não escolha framework; a pasta `api/` será detectada como Vercel Functions.
5. Adicione as variáveis:

```text
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_SUA_CHAVE
ALLOWED_ORIGIN=https://SEU-FRONT.vercel.app
RESEND_API_KEY=
EMAIL_FROM=
```

6. Faça o deploy.
7. Teste `https://SEU-BACK.vercel.app/api/health`.

Nunca adicione a chave secreta em uma variável `NEXT_PUBLIC_*`.

## 3. Projeto do frontend na Vercel

1. Importe o mesmo repositório novamente.
2. Nome sugerido: `medix-web`.
3. Em **Root Directory**, selecione `apps/web`.
4. Mantenha o framework Next.js.
5. Adicione:

```text
NEXT_PUBLIC_API_URL=https://SEU-BACK.vercel.app/api
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE
```

6. Faça o deploy.

Se usar a chave antiga, substitua `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` por
`NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## 4. Ajuste final do CORS

Depois de conhecer a URL definitiva do frontend, volte ao projeto `medix-api` e
confirme que `ALLOWED_ORIGIN` possui exatamente essa URL, sem barra no final.
Faça um redeploy da API após a alteração.

## 5. Checklist

- `GET /api/health` responde `status: ok`;
- cadastro e login funcionam pelo Supabase Auth;
- recuperação de senha retorna para `/auth`;
- proprietário acessa a equipe;
- colaborador respeita as permissões;
- super admin acessa `/admin`;
- nenhuma chave `sb_secret_` aparece no projeto web;
- `.env` e `.env.local` continuam fora do Git.

## Recuperar ou criar um acesso de super admin

O console usa `/admin/login`. A conta precisa existir no Supabase Auth e seu
`user_id` precisa estar em `public.platform_admins`. O cadastro público não concede
essa permissão automaticamente.

### Recuperar o acesso existente

No SQL Editor do projeto Supabase usado pela API, consulte os e-mails administrativos:

```sql
select u.email
from public.platform_admins a
join auth.users u on u.id = a.user_id;
```

Use **Esqueceu a senha?** em `/admin/login`. O link recebido abre `/auth` para
redefinir a senha; depois, volte a `/admin/login` para acessar o console.
A URL `/auth` precisa estar autorizada nos redirects do Supabase.

### Autorizar uma nova conta

1. Crie a conta em `/auth?mode=signup`, usando um e-mail que você controla.
2. Confirme o e-mail, caso solicitado. Não é necessário criar uma clínica.
3. No SQL Editor, substitua `novo-admin@exemplo.com` pelo e-mail exato e execute:

```sql
insert into public.platform_admins (user_id)
select id
from auth.users
where lower(email) = lower('novo-admin@exemplo.com')
on conflict (user_id) do nothing
returning user_id;
```

Se retornar um UUID, o acesso foi concedido. Se não retornar nenhuma linha,
confira se a conta já existe ou se já está autorizada:

```sql
select u.id, u.email, (a.user_id is not null) as super_admin
from auth.users u
left join public.platform_admins a on a.user_id = u.id
where lower(u.email) = lower('novo-admin@exemplo.com');
```

Entre em `/admin/login` com o novo e-mail e a senha definida por você.
A conta administrativa anterior permanece autorizada; este procedimento não a
remove nem altera as clínicas existentes.

## Limites dos planos gratuitos

Supabase e Vercel possuem cotas. O projeto pode começar nas faixas gratuitas,
mas uma aplicação comercial ou com crescimento pode exigir plano pago. Configure
alertas de uso nos dois painéis e revise os termos do plano antes do lançamento.

## Diagnóstico do acesso administrativo local

Se a autenticação funcionar, mas o console não abrir:

- Confirme `NEXT_PUBLIC_API_URL=http://localhost:8080` em `apps/web/.env.local`.
- Preencha `apps/api/.env.local` com as variáveis do backend e execute `npm run dev:api`.
- Use `ALLOWED_ORIGIN=http://localhost:3000,http://127.0.0.1:3000` para os dois endereços locais.
- Confira `/health` na API. A resposta deve conter `status: ok`.
- Se os logs indicarem `permission denied for table platform_admins`, revise e
  aplique `supabase/migrations/018_admin_api_read_permissions.sql` no projeto usado
  pela API. Ela concede somente SELECT em `platform_admins`, `profiles` e `clinics`
  ao papel interno `service_role`, necessário para verificar o administrador e
  carregar a lista inicial do console.

- Para erros de permissão ao editar clínicas, gerar backup ou notificar atualização,
  revise e aplique `supabase/migrations/019_admin_api_operation_permissions.sql`.
  Ela libera ao `service_role` edição das colunas administrativas e exclusão de
  clínicas, leitura de pacientes/agendamentos para backup e leitura/atualização
  do controle em `platform_settings`. A API verifica o super admin antes dessas
  operações; a migration não modifica as permissões de `anon`/`authenticated`.
