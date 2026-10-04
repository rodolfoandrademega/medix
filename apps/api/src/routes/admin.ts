import type { FastifyInstance } from "fastify";
import { requirePlatformAdmin } from "../access.js";
import { requireUser, type AuthenticatedRequest } from "../auth.js";
import { database } from "../supabase.js";

const modules = ["overview", "agenda", "patients", "procedures", "team", "financial", "reports"];
const statuses = ["pending", "active", "suspended", "inactive"];

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get("/v1/admin/clinics", { preHandler: requireUser }, async (request) => {
    const userId = (request as AuthenticatedRequest).userId; await requirePlatformAdmin(userId);
    const [{ data: profile }, { data, error }] = await Promise.all([
      database.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      database.from("clinics").select("id,name,slug,status,plan_name,created_at,enabled_modules,admin_alert_title,admin_alert_message,admin_alert_level").order("created_at", { ascending: false }),
    ]);
    if (error) throw error; return { admin: profile, clinics: data || [] };
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>("/v1/admin/clinics/:id", { preHandler: requireUser }, async (request) => {
    await requirePlatformAdmin((request as AuthenticatedRequest).userId);
    const allowed = ["name", "plan_name", "admin_alert_title", "admin_alert_message", "admin_alert_level"];
    const payload = Object.fromEntries(allowed.filter((key) => key in request.body).map((key) => [key, request.body[key]]));
    if (typeof request.body.status === "string" && statuses.includes(request.body.status)) payload.status = request.body.status;
    if (request.body.enabled_modules && typeof request.body.enabled_modules === "object") payload.enabled_modules = Object.fromEntries(modules.map((key) => [key, (request.body.enabled_modules as Record<string, unknown>)[key] === true]));
    payload.status_updated_at = new Date().toISOString();
    const { data, error } = await database.from("clinics").update(payload).eq("id", request.params.id).select("*").single();
    if (error) throw error; return { clinic: data };
  });

  app.delete<{ Params: { id: string } }>("/v1/admin/clinics/:id", { preHandler: requireUser }, async (request, reply) => {
    await requirePlatformAdmin((request as AuthenticatedRequest).userId);
    const { error } = await database.from("clinics").delete().eq("id", request.params.id); if (error) throw error;
    return reply.status(204).send();
  });

  app.get<{ Params: { id: string } }>("/v1/admin/clinics/:id/backup", { preHandler: requireUser }, async (request) => {
    await requirePlatformAdmin((request as AuthenticatedRequest).userId);
    const [clinic, patients, appointments] = await Promise.all([
      database.from("clinics").select("*").eq("id", request.params.id).single(),
      database.from("patients").select("*").eq("clinic_id", request.params.id).order("created_at"),
      database.from("appointments").select("*").eq("clinic_id", request.params.id).order("starts_at"),
    ]);
    if (clinic.error) throw clinic.error; if (patients.error) throw patients.error; if (appointments.error) throw appointments.error;
    return { generated_at: new Date().toISOString(), clinic: clinic.data, patients: patients.data || [], appointments: appointments.data || [] };
  });

  app.post("/v1/admin/refresh", { preHandler: requireUser }, async (request) => {
    await requirePlatformAdmin((request as AuthenticatedRequest).userId); const now = new Date().toISOString();
    const { error } = await database.from("platform_settings").update({ refresh_requested_at: now, updated_at: now }).eq("singleton", true);
    if (error) throw error; return { refresh_requested_at: now };
  });
}
