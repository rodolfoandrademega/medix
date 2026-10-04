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

## Limites dos planos gratuitos

Supabase e Vercel possuem cotas. O projeto pode começar nas faixas gratuitas,
mas uma aplicação comercial ou com crescimento pode exigir plano pago. Configure
alertas de uso nos dois painéis e revise os termos do plano antes do lançamento.
