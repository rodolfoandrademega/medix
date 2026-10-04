import type { FastifyRequest } from "fastify";
import { firebaseAuth } from "./firebase.js";
import { database } from "./supabase.js";

export type AuthenticatedRequest = FastifyRequest & { userId: string };

export async function requireUser(request: FastifyRequest) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) throw Object.assign(new Error("Sessão não encontrada."), { statusCode: 401 });

  try {
    const decoded = await firebaseAuth.verifyIdToken(token);
    // A migração preserva os UUIDs do Supabase como uid do Firebase.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decoded.uid)) {
      throw new Error("Identificador de usuário inválido.");
    }
    (request as AuthenticatedRequest).userId = decoded.uid;
    return;
  } catch {
    // Janela de migração: aceita a sessão antiga até todos os usuários estarem no Firebase.
    const { data, error } = await database.auth.getUser(token);
    if (!error && data.user) {
      (request as AuthenticatedRequest).userId = data.user.id;
      return;
    }
    throw Object.assign(new Error("Sua sessão expirou. Entre novamente."), { statusCode: 401 });
  }
}
