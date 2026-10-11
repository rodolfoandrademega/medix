import cors from "@fastify/cors";
import Fastify from "fastify";
import { config } from "./config.js";
import { requireUser } from "./auth.js";
import { database } from "./supabase.js";
import { registerTeamRoutes } from "./routes/team.js";
import { registerWorkspaceRoutes } from "./routes/workspace.js";
import { registerClinicDataRoutes } from "./routes/clinic-data.js";
import { registerOperationRoutes } from "./routes/operations.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerPushRoutes } from "./routes/push.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: config.allowedOrigin.split(",").map((origin) => origin.trim()),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Clinic-Id"],
  });

  app.get("/health", async () => ({ status: "ok", service: "medix-api", hosting: "vercel" }));
  await registerTeamRoutes(app);
  await registerWorkspaceRoutes(app);
  await registerClinicDataRoutes(app);
  await registerOperationRoutes(app);
  await registerAdminRoutes(app);
  await registerPushRoutes(app);

  app.get("/v1/me", { preHandler: requireUser }, async (request) => {
    const { userId } = request as typeof request & { userId: string };
    const { data, error } = await database
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return { user: data };
  });

  app.setErrorHandler((error, _request, reply) => {
    const appError = error as Error & { statusCode?: number };
    const dbCode = (error as { code?: string }).code;
    let statusCode = typeof appError.statusCode === "number" ? appError.statusCode : 500;
    let message = appError.message;
    if (dbCode === "23505") { statusCode = 409; message = "Já existe um registro com esse identificador. Confira os dados informados."; }
    else if (dbCode === "23503") { statusCode = 409; message = "Este registro possui vínculos ou dados relacionados inválidos."; }
    else if (["23502", "23514", "22P02", "22007", "22008"].includes(dbCode || "")) { statusCode = 400; message = "Confira os campos obrigatórios e os formatos dos dados informados."; }
    if (statusCode >= 500) {
      // Erros SQL podem trazer valores de linhas clínicas em details/message.
      // Registre apenas metadados técnicos, nunca o objeto bruto do banco.
      const code = (error as { code?: unknown }).code;
      app.log.error({ code: typeof code === "string" ? code : undefined, statusCode }, "Falha interna da API");
    }
    return reply.status(statusCode).send({ message: statusCode >= 500 ? "Erro interno do servidor." : message });
  });

  return app;
}
