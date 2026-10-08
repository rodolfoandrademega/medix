# Medix Platform

Monorepo do sistema de gestão multi-clínica Medix.

```text
apps/web   Frontend Next.js para Vercel
apps/api   Backend Fastify para Vercel Functions
supabase   Migrations do PostgreSQL
docs       Guias de migração e deploy
```

## Rodar localmente

Copie `apps/web/.env.example` para `apps/web/.env.local` e
`apps/api/.env.example` para `apps/api/.env.local`. Preencha as variáveis do
Supabase e mantenha `NEXT_PUBLIC_API_URL=http://localhost:8080` no frontend.
A API carrega seu `.env.local` automaticamente no comando de desenvolvimento.

```bash
npm install
npm run dev:api
npm run dev:web
```

O frontend abre em `http://localhost:3000` e a API em `http://localhost:8080`.

## Validação

```bash
npm run build
```

O comando compila API e frontend. Consulte [ARCHITECTURE.md](./ARCHITECTURE.md) para os limites de segurança e [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) para publicar os dois projetos na Vercel com Supabase.
