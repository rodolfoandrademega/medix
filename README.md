# Medix Platform

Monorepo do sistema de gestão multi-clínica Medix.

```text
apps/web   Frontend Next.js para Vercel
apps/api   Backend Fastify para Google Cloud Run
supabase   Migrations do PostgreSQL
docs       Guias de migração e deploy
```

## Rodar localmente

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

O comando compila API e frontend. Consulte [ARCHITECTURE.md](./ARCHITECTURE.md) para os limites de segurança e [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) para publicar no Google Cloud, GitHub e Vercel.
