import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

/** Banco acessado somente pelo backend. Esta chave nunca vai para Vercel. */
export const database = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
