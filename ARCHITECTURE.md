# Arquitetura da Medix

```text
apps/web (Vercel) ──HTTPS + token──> apps/api (Cloud Run) ──service_role──> Supabase PostgreSQL
       │                                  │
       └──────── Firebase Web SDK ────────┴── Firebase Admin SDK
```

## Limites

- `apps/web`: apresentação Next.js. Não possui regras privilegiadas nem chave de serviço.
- `apps/api`: API Fastify, autenticação, autorização, isolamento por clínica e integrações.
- `supabase/migrations`: esquema e evolução do PostgreSQL.
- `docs`: operação, migração e deploy.

Toda operação clínica valida novamente o vínculo e a permissão no backend. Identificadores enviados pelo browser não definem a clínica consultada; a API resolve a clínica pelo usuário autenticado.

## Segurança de credenciais

- Vercel recebe somente `NEXT_PUBLIC_API_URL` e configuração pública Firebase.
- Cloud Run recebe `SUPABASE_SERVICE_ROLE_KEY` pelo Secret Manager.
- Nenhuma variável privada usa o prefixo `NEXT_PUBLIC_`.
- O banco permanece com RLS e, no corte Firebase, o acesso direto de `anon` e `authenticated` é revogado.

## Transição de autenticação

Enquanto `AUTH_PROVIDER=supabase`, a API aceita a sessão antiga para preservar a produção. Após importar usuários com o mesmo UUID e aplicar a migration `018`, altere para `AUTH_PROVIDER=firebase`. O frontend escolhe Firebase automaticamente quando todas as variáveis `NEXT_PUBLIC_FIREBASE_*` estão presentes.
