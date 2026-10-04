import type { FastifyRequest } from "fastify";
import { database } from "./supabase.js";

export type AuthenticatedRequest = FastifyRequest & { userId: string };

export async function requireUser(request: FastifyRequest) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) throw Object.assign(new Error("Sessão não encontrada."), { statusCode: 401 });

  const { data, error } = await database.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error("Sua sessão expirou. Entre novamente."), { statusCode: 401 });
  (request as AuthenticatedRequest).userId = data.user.id;
}
