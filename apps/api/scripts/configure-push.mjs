import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const directory = fileURLToPath(new URL("../", import.meta.url));
const keyFile = `${directory}.env.push-keys.local`;
const url = process.env.SUPABASE_URL, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Carregue apps/api/.env.local para configurar o push.");
const database = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const secret = await database.rpc("medix_push_setup_secret");
if (secret.error || typeof secret.data !== "string" || !/^[a-f0-9]{64}$/.test(secret.data)) {
  throw new Error("Execute supabase/setup/push_cron.sql no Supabase antes de rodar este script.");
}
let keys;
if (existsSync(keyFile)) {
  const lines = Object.fromEntries(readFileSync(keyFile, "utf8").split("\n").filter(line => line.includes("=")).map(line => { const split = line.indexOf("="); return [line.slice(0, split), line.slice(split + 1)]; }));
  keys = { publicKey: lines.VAPID_PUBLIC_KEY, privateKey: lines.VAPID_PRIVATE_KEY };
  if (!keys.publicKey || !keys.privateKey) throw new Error("Backup VAPID inválido. Não substitua chaves de dispositivos já inscritos.");
} else {
  keys = webpush.generateVAPIDKeys();
  // Artefato privado de geração de chaves; ignorado pelo Git. Nunca imprime valores.
  writeFileSync(keyFile, `VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\n`, { mode: 0o600, flag: "wx" });
}
chmodSync(keyFile, 0o600);
const values = {
  VAPID_PUBLIC_KEY: keys.publicKey,
  VAPID_PRIVATE_KEY: keys.privateKey,
  VAPID_SUBJECT: "https://medix-duas.vercel.app",
  PUSH_CRON_SECRET: secret.data,
};
for (const [name, value] of Object.entries(values)) {
  const sensitive = name === "VAPID_PRIVATE_KEY" || name === "PUSH_CRON_SECRET";
  const command = spawnSync("npx", ["--yes", "vercel", "env", "add", name, "production", "--project", "medix-api", "--scope", "dofomega", "--yes", "--force", sensitive ? "--sensitive" : "--no-sensitive"], { cwd: directory, input: value, encoding: "utf8", timeout: 60000 });
  // Não repassa stdout/stderr da ferramenta: podem conter dados de configuração.
  if (command.status !== 0) throw new Error(`Não foi possível cadastrar ${name}. Confira o login da CLI e tente novamente.`);
  console.log(`${name}: configurada em medix-api/Production (${sensitive ? "Secret" : "Config"}).`);
}
console.log("Chaves preservadas no backup local privado. Faça redeploy da API para carregar as variáveis.");
