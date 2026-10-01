import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// A integração atual do Supabase usa "publishable key"; projetos antigos usam "anon key".
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Só é inicializado quando as credenciais forem adicionadas ao .env.local.
export const supabase = url && key ? createClient(url, key) : null;
