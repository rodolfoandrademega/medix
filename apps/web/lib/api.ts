import { supabase } from "./supabase";

const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly kind: "configuration" | "network" | "response" = "response") {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  if (!apiUrl) throw new ApiError("NEXT_PUBLIC_API_URL não foi configurada.", 0, "configuration");
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, init);
  } catch {
    throw new ApiError("Não foi possível conectar à API da Medix.", 0, "network");
  }
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null) as (T & { message?: string }) | null;
  if (!response.ok) throw new ApiError(payload?.message || "Não foi possível concluir a operação.", response.status);
  if (payload === null) throw new ApiError("A API retornou uma resposta inválida.", response.status);
  return payload;
}

export async function publicApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(path, { ...init, headers: { ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}), ...init.headers } });
}

async function accessToken() {
  const { data } = await supabase?.auth.getSession() || { data: { session: null } };
  return data.session?.access_token;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiUrl) throw new ApiError("NEXT_PUBLIC_API_URL não foi configurada.", 0, "configuration");
  const token = await accessToken();
  if (!token) throw new ApiError("Sua sessão expirou. Entre novamente.", 401);
  return request<T>(path, {
    ...init,
    headers: { ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token}`, ...init.headers },
  });
}
