import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Projetos antigos usam anon key; a integração atual usa publishable key.
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Cliente exclusivo do navegador. Nunca coloque chaves de serviço aqui. */
export const supabase = url && key ? createClient(url, key) : null;
