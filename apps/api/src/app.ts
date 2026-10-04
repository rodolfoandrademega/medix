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

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: config.allowedOrigin.split(",").map((origin) => origin.trim()),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  });

  app.get("/health", async () => ({ status: "ok", service: "medix-api", hosting: "vercel" }));
  await registerTeamRoutes(app);
  await registerWorkspaceRoutes(app);
  await registerClinicDataRoutes(app);
  await registerOperationRoutes(app);
  await registerAdminRoutes(app);

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
    const statusCode = typeof appError.statusCode === "number" ? appError.statusCode : 500;
    if (statusCode >= 500) app.log.error(error);
    return reply.status(statusCode).send({ message: statusCode >= 500 ? "Erro interno do servidor." : appError.message });
  });

  return app;
}
