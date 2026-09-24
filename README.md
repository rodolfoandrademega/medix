# Medix

Sistema de gestão multi-clínica, construído com Next.js e preparado para Supabase e Vercel.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. A landing page está em `/` e o painel demonstrativo em `/dashboard`.

## Conectar ao Supabase

1. Crie um projeto no Supabase.
2. No **SQL Editor**, execute `supabase/migrations/001_initial_schema.sql`.
3. Copie `.env.example` para `.env.local` e preencha a URL e a chave anônima do projeto.
4. Configure os provedores de login em Authentication quando formos criar o fluxo de acesso.

Depois da primeira migration, execute também `supabase/migrations/002_auth_and_onboarding.sql`. Ela cria o perfil do usuário no cadastro e disponibiliza a função segura que abre uma clínica associando o criador como proprietário.

O banco já usa `clinic_id` em pacientes e consultas, além de Row Level Security, para impedir acesso entre clínicas.

## Deploy na Vercel

Suba este repositório ao GitHub e importe-o na Vercel. Adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` nas variáveis de ambiente do projeto antes do deploy.
