import { firebaseAuth } from "./firebase";
import { supabase } from "./supabase";

const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

export async function publicApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL não foi configurada.");
  const response = await fetch(`${apiUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  const payload = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new Error(payload.message || "Não foi possível concluir a operação.");
  return payload;
}

async function accessToken() {
  if (firebaseAuth?.currentUser) return firebaseAuth.currentUser.getIdToken();
  const { data } = await supabase?.auth.getSession() || { data: { session: null } };
  return data.session?.access_token;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL não foi configurada.");
  const token = await accessToken();
  if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init.headers },
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new Error(payload.message || "Não foi possível concluir a operação.");
  return payload;
}
