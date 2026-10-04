import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { firebaseAuth } from "../firebase.js";
import { database } from "../supabase.js";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post<{ Body: { email?: string; password?: string; fullName?: string } }>("/v1/auth/register", async (request, reply) => {
    if (config.authProvider !== "firebase") return reply.status(409).send({ message: "O cadastro Firebase ainda não foi ativado." });
    const email = request.body.email?.trim().toLowerCase(); const password = request.body.password; const fullName = request.body.fullName?.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email) || !password || password.length < 8 || !fullName) return reply.status(400).send({ message: "Informe nome, e-mail e senha de ao menos 8 caracteres." });
    const uid = randomUUID();
    try {
      await firebaseAuth.createUser({ uid, email, password, displayName: fullName, emailVerified: true });
      const { error } = await database.from("profiles").insert({ id: uid, full_name: fullName });
      if (error) { await firebaseAuth.deleteUser(uid); throw error; }
      return reply.status(201).send({ message: "Conta criada." });
    } catch (error) {
      if ((error as { code?: string }).code === "auth/email-already-exists") return reply.status(409).send({ message: "Já existe uma conta com este e-mail." });
      throw error;
    }
  });
}
