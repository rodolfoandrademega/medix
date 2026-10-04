# Arquitetura Medix

```text
Navegador
  ├─ Supabase Auth (sessão do usuário)
  └─ HTTPS + token
       ↓
apps/api — Vercel Functions
       ↓ chave secreta somente no servidor
Supabase PostgreSQL
```

## Aplicações

- `apps/web`: frontend Next.js publicado como um projeto Vercel.
- `apps/api`: backend Fastify publicado como outro projeto Vercel.
- `supabase/migrations`: esquema, funções e políticas do PostgreSQL.

Os dois projetos Vercel usam o mesmo repositório, mas possuem Root Directory e
variáveis de ambiente diferentes.

## Segurança

- O frontend recebe somente a URL, chave pública do Supabase e URL da API.
- A chave `sb_secret_` fica exclusivamente no projeto `medix-api` da Vercel.
- Toda rota de negócio valida o access token do Supabase.
- Toda operação valida clínica, função e permissões no backend.
- RLS permanece ativa como camada adicional de proteção.
- Regras de negócio e credenciais administrativas não são enviadas ao navegador.

O repositório deve permanecer privado e o acesso deve ser limitado à equipe técnica.
