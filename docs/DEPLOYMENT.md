# Publicação da Medix

## 1. GitHub

Revise os arquivos antes do primeiro envio. `.env.local`, chaves e credenciais estão ignorados pelo Git.

```bash
git status
npm run build
git add .
git commit -m "refactor: separa frontend e backend"
git push origin main
```

## 2. Google Cloud e Firebase

1. Acesse o Google Cloud Console e crie ou selecione o projeto da Medix.
2. Vincule esse mesmo projeto no Firebase Console.
3. No Firebase, abra **Authentication > Sign-in method** e habilite **E-mail/senha**.
4. Em **Configurações do projeto > Seus aplicativos**, registre um aplicativo Web.
5. Instale e autentique a CLI `gcloud`.
6. Ative Cloud Run, Cloud Build, Artifact Registry, Secret Manager e Identity Toolkit.

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project SEU_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com identitytoolkit.googleapis.com
```

Crie o segredo da chave de serviço do Supabase. Digite o valor somente quando o terminal solicitar:

```bash
gcloud secrets create medix-supabase-service-role --replication-policy=automatic
gcloud secrets versions add medix-supabase-service-role --data-file=-
```

Crie uma conta de serviço exclusiva e conceda somente Firebase Auth Admin e leitura desse segredo. Substitua `SEU_PROJECT_ID` em todos os comandos:

```bash
gcloud iam service-accounts create medix-api --display-name="Medix API Cloud Run"
gcloud projects add-iam-policy-binding SEU_PROJECT_ID --member="serviceAccount:medix-api@SEU_PROJECT_ID.iam.gserviceaccount.com" --role="roles/firebaseauth.admin"
gcloud secrets add-iam-policy-binding medix-supabase-service-role --member="serviceAccount:medix-api@SEU_PROJECT_ID.iam.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
```

Depois publique primeiro com a autenticação antiga:

```bash
gcloud run deploy medix-api --source apps/api --region southamerica-east1 --allow-unauthenticated --service-account=medix-api@SEU_PROJECT_ID.iam.gserviceaccount.com --set-env-vars FIREBASE_PROJECT_ID=SEU_PROJECT_ID,AUTH_PROVIDER=supabase,SUPABASE_URL=https://SEU_PROJETO.supabase.co,ALLOWED_ORIGIN=https://SEU_FRONT.vercel.app --set-secrets SUPABASE_SERVICE_ROLE_KEY=medix-supabase-service-role:latest
```

Copie a URL exibida pelo Cloud Run e teste `URL_DA_API/health`.

## 3. Vercel

1. Importe o mesmo repositório GitHub na Vercel.
2. Em **Root Directory**, selecione `apps/web`.
3. Mantenha Framework Preset como Next.js.
4. Adicione `NEXT_PUBLIC_API_URL` com a URL do Cloud Run.
5. Durante a transição mantenha também `NEXT_PUBLIC_SUPABASE_URL` e a chave pública usada hoje.
6. Faça o deploy e adicione a URL Vercel em `ALLOWED_ORIGIN` no Cloud Run.

## 4. Corte definitivo para Firebase

Não faça estes passos antes de validar a API e importar os usuários existentes.

1. Faça um backup do banco no painel do Supabase.
2. Na sua máquina, copie `apps/api/.env.example` para `apps/api/.env` e preencha temporariamente as variáveis da API, inclusive Resend e `FRONTEND_URL`.
3. Com `gcloud auth application-default login` ativo, importe os usuários preservando os UUIDs:

```bash
npm run migrate:firebase --workspace @medix/api
```

O comando lê automaticamente `apps/api/.env`. Não copie esse arquivo para o Git
nem compartilhe as chaves secretas do Supabase.

O script cria os usuários com os mesmos IDs, gera a redefinição de senha e envia pelo Resend quando configurado. Confira no resumo final se `notified` é igual a `imported`.

4. Adicione na Vercel `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID` e `NEXT_PUBLIC_FIREBASE_APP_ID`.
5. Faça um novo deploy da Vercel e confirme que um usuário importado consegue entrar após redefinir a senha.
6. Execute `supabase/migrations/018_external_firebase_auth_cutover.sql` no SQL Editor.
7. Altere no Cloud Run `AUTH_PROVIDER=firebase` e publique nova revisão.
8. Valide proprietário, colaborador e super admin.
9. Remova da Vercel todas as variáveis `NEXT_PUBLIC_SUPABASE_*`.

Após o corte, o navegador conversa apenas com Firebase Auth e Cloud Run. O Supabase fica inacessível diretamente para usuários do frontend.
