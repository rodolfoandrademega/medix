# Migração: Firebase Auth + Cloud Run

Objetivo final:

```text
Vercel (Next.js) -> Cloud Run API -> Supabase PostgreSQL
                       |
                  Firebase Authentication
```

O browser não terá chave `SUPABASE_*` e não fará chamadas diretas ao Supabase após o corte. A chave de serviço ficará apenas no Cloud Run, preferencialmente no Secret Manager.

## 1. Criar e configurar o Firebase

1. Crie um projeto Firebase no mesmo projeto Google Cloud que hospedará o Cloud Run.
2. Em **Authentication**, habilite **E-mail/senha**.
3. Registre o aplicativo Web da Medix e guarde a configuração pública Firebase para a Vercel.
4. Configure domínios autorizados para o domínio Vercel e o domínio definitivo da Medix.

## 2. Preservar os usuários atuais

Os IDs atuais em `profiles.id` e `clinic_members.user_id` são UUIDs do Supabase Auth. O comando `npm run migrate:firebase --workspace @medix/api` importa cada usuário usando o mesmo UUID no campo `uid`, preservando todos os vínculos da clínica.

Não é possível migrar hashes de senha do Supabase Auth diretamente sem os parâmetros de hash e o procedimento de exportação apropriado. O caminho seguro é criar as contas no Firebase e exigir redefinição de senha no primeiro acesso.

## 3. Corte de banco — ainda não execute

Só crie a migration de corte depois de todas as telas usarem a API Cloud Run. Ela deverá remover a FK `profiles.id -> auth.users`, desativar o trigger `on_auth_user_created` e revogar o acesso direto de `anon`/`authenticated` às tabelas públicas. Executá-la agora interromperia login e painel atuais.

## 4. Variáveis de ambiente

Na Vercel use apenas as variáveis públicas `NEXT_PUBLIC_FIREBASE_*` e `NEXT_PUBLIC_API_URL`.

No Cloud Run use `FIREBASE_PROJECT_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGIN` e, se desejar e-mail, `RESEND_API_KEY` e `EMAIL_FROM`. As chaves privadas devem ser criadas no Secret Manager, não em arquivos nem no Git.

## 5. Publicar a API

Após instalar as dependências em `apps/api`, configure o projeto e faça deploy:

```bash
cd apps/api
npm install
gcloud auth application-default login
gcloud run deploy medix-api --source . --region southamerica-east1 --allow-unauthenticated
```

O Cloud Run é público para receber requisições do navegador, mas cada rota de negócio valida o token Firebase `Authorization: Bearer <ID_TOKEN>`. Restrinja o CORS pela variável `ALLOWED_ORIGIN`.

## Próximas rotas a migrar

1. Login, cadastro e recuperação de senha para Firebase Auth no frontend.
2. `me` e workspace atual.
3. Pacientes e prontuário.
4. Agenda e procedimentos.
5. Colaboradores e administração da plataforma.
6. Só então aplicar a migration de corte no Supabase.
