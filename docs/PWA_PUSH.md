# PWA: push com o aplicativo fechado e login persistente

Esta configuração usa a API na Vercel, Supabase Cron/Vault e Web Push. Não requer Google Cloud nem provedor de WhatsApp/e-mail. O consumo continua sujeito aos limites dos planos de hospedagem e do banco; a entrega pelo sistema operacional não é garantida ou instantânea.

## Configuração automatizada

Depois da migration 023, faça login na CLI (`npx vercel login`) e execute `supabase/setup/push_cron.sql` no SQL Editor. O script gera o segredo diretamente no Vault, não mostra seu valor e prepara a rotina. A função auxiliar de configuração fica acessível somente ao `service_role` e lê apenas o segredo deste job.

Com as credenciais existentes da API em `apps/api/.env.local`, rode na raiz:

```sh
node --env-file=apps/api/.env.local apps/api/scripts/configure-push.mjs
```

Ele gera/preserva o par VAPID em `apps/api/.env.push-keys.local` (privado, ignorado pelo Git), busca o segredo específico do Vault e cadastra as quatro variáveis em **medix-api / Production**, sem imprimir valores. Depois, faça o redeploy da API e confira o job. Não envie o arquivo privado pelo chat nem pelo Git. A configuração manual abaixo é uma alternativa; não gere outro par se já usou o script automatizado.

## 1. Banco

No SQL Editor do Supabase de produção, execute todo o arquivo `supabase/migrations/023_pwa_push_notifications.sql`.
As tabelas têm RLS e nenhum acesso de `anon`/`authenticated`. Somente a API administra as inscrições e a fila. A seleção de destinatários continua respeitando o vínculo com a clínica, o módulo agenda e as permissões atuais.

## 2. Chaves e variáveis da API

Na raiz do projeto, gere um par VAPID UMA VEZ:

```sh
npm exec --workspace @medix/api -- web-push generate-vapid-keys --json
```

Gere também um secret independente para a rotina:

```sh
openssl rand -hex 32
```

Vercel → projeto **medix-api** → Environment Variables → Production. Adicione:

| Nome | Valor | Tipo |
| --- | --- | --- |
| `VAPID_PUBLIC_KEY` | `publicKey` do comando | Config |
| `VAPID_PRIVATE_KEY` | `privateKey` do comando | Secret |
| `VAPID_SUBJECT` | `https://medix-duas.vercel.app` | Config |
| `PUSH_CRON_SECRET` | resultado do `openssl` | Secret |

Não coloque a chave privada nem o secret no front, em variáveis `NEXT_PUBLIC_*`, no Git ou no chat. Guarde o par VAPID com segurança: trocar as chaves requer reinscrever os dispositivos. Para testes locais, coloque os mesmos nomes em `apps/api/.env.local`.

## 3. Envio a cada minuto

1. No Supabase, Database → Extensions: habilite `pg_cron` e `pg_net`, se ainda não estiverem ativos.
2. Abra Vault no Supabase e crie o secret **medix_push_cron_secret**, com o MESMO valor de `PUSH_CRON_SECRET` da Vercel.
3. Depois de publicar/redeployar a API com as variáveis, execute `supabase/setup/push_cron.sql` no SQL Editor.
4. Em Integrations → Cron → Jobs, confirme que **medix-push-every-minute** está Active.
5. Veja History do job e os Runtime Logs da API. Chamadas a `/api/internal/push/dispatch` devem retornar **204**, não 401/503/500.

Não coloque `service_role` em headers de pg_net. O script usa uma assinatura de escopo único que vence em 90 segundos; a chave permanente fica no Vault. Não exponha o Vault a membros comuns.

A fila tem claim atômico, timeout, retries e deduplicação por dispositivo/evento. Inscrições expiradas são removidas. Cancelar uma consulta, remover um destinatário ou revogar acesso impede novos envios da fila. Há até 20 avisos por execução; volumes maiores exigem ajuste de capacidade. Reexecução após falha de rede pode duplicar a entrega, mas o `tag` substitui o aviso equivalente no dispositivo.

## 4. No celular/computador

1. Instale a Medix pelo navegador. No iPhone/iPad (iOS/iPadOS 16.4+), Safari → Compartilhar → Adicionar à Tela de Início.
2. Abra o app instalado e faça login. A sessão do app instalado pode ser separada da sessão da aba do navegador.
3. Abra o sino → **Ativar notificações push** → permita as notificações no sistema.
4. Escolha 5, 15, 30 ou 60 minutos de antecedência.
5. Ao agendar, selecione essa pessoa em **Quem deve receber os avisos?**.
6. Feche o app e teste com uma consulta próxima. Confira criação e proximidade; lembretes dependem de internet, permissões, execução da rotina e restrições do sistema.

Instalar ou fazer login NÃO concede permissão de notificação automaticamente. Cada dispositivo precisa de ativação explícita. O texto do push não contém paciente, procedimento ou observações; ao tocar, abre o dashboard autenticado. Um dispositivo recebe push da última conta/clínica ativada nele. O logout desvincula o push e remove a inscrição local.

## 5. Permanecer conectado

O cliente já usa `persistSession: true` e `autoRefreshToken: true`; a API web também renova tokens próximos do vencimento. Não guarda a senha e não estende artificialmente a validade do JWT.
No Supabase → Authentication → Sessions, confira os limites de duração/inatividade existentes antes de alterá-los. Sessões padrão persistem até logout/revogação; alterações de senha, políticas de segurança, limpeza de dados do navegador e expiração configurada podem exigir novo login. Não é recomendado remover proteções de sessão indiscriminadamente em dispositivos compartilhados.

Referências: [Supabase Sessions](https://supabase.com/docs/guides/auth/sessions), [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart), [Web Push no iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [segurança dos headers pg_net](https://supabase.com/docs/guides/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net-ad6357).

## Verificações e pendências

Build de front/API e testes automatizados de validação de destinos, assinatura/expiração e autenticação foram executados. A migration e a rotina precisam ser executadas e testadas no Supabase; não há PostgreSQL local disponível neste ambiente. A entrega a um dispositivo real depende das configurações acima.
Os alertas encontrados foram tratados: removido o builder `@vercel/node`, usado somente para tipos, e atualizado `sharp` para o patch corrigido. O contrato do handler permanece tipado com interfaces estruturais do Node. A auditoria posterior reportou zero vulnerabilidades conhecidas; isso não equivale a garantia de ausência de falhas.
