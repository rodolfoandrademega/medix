import type { FastifyInstance } from "fastify";
import { getClinicAccess, requirePermission } from "../access.js";
import { requireUser, type AuthenticatedRequest } from "../auth.js";
import { database } from "../supabase.js";

const clean = (body: Record<string, unknown>, fields: string[]) => Object.fromEntries(fields.filter((key) => key in body).map((key) => [key, body[key]]));

export async function registerOperationRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { from?: string; to?: string; reminders?: string } }>("/v1/appointments", { preHandler: requireUser }, async (request) => {
    const access = await getClinicAccess((request as AuthenticatedRequest).userId); requirePermission(access, "agenda");
    const selection = request.query.reminders === "true" ? "id,starts_at,patients(full_name),procedures(name)" : "id,patient_id,procedure_id,professional_id,starts_at,ends_at,status,notes,duration_minutes,patients(full_name),procedures(name,color)";
    let query = database.from("appointments").select(selection).eq("clinic_id", access.clinicId).order("starts_at");
    if (request.query.from) query = query.gte("starts_at", request.query.from);
    if (request.query.to) query = query.lt("starts_at", request.query.to);
    if (request.query.reminders === "true") query = query.in("status", ["scheduled", "confirmed"]);
    const { data, error } = await query; if (error) throw error; return { appointments: data || [] };
  });

  app.post<{ Body: Record<string, unknown> }>("/v1/appointments", { preHandler: requireUser }, async (request, reply) => {
    const access = await getClinicAccess((request as AuthenticatedRequest).userId); requirePermission(access, "agenda");
    const fields = ["patient_id", "procedure_id", "professional_id", "starts_at", "ends_at", "status", "notes", "duration_minutes"];
    const payload = clean(request.body, fields);
    if (!payload.patient_id || !payload.starts_at || !payload.ends_at) return reply.status(400).send({ message: "Informe paciente, data e horário." });
    const { data, error } = await database.from("appointments").insert({ clinic_id: access.clinicId, ...payload }).select("*").single();
    if (error) throw error; return reply.status(201).send({ appointment: data });
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>("/v1/appointments/:id", { preHandler: requireUser }, async (request) => {
    const access = await getClinicAccess((request as AuthenticatedRequest).userId); requirePermission(access, "agenda");
    const fields = ["starts_at", "ends_at", "status", "notes", "duration_minutes", "patient_id", "procedure_id", "professional_id"];
    const { data, error } = await database.from("appointments").update(clean(request.body, fields)).eq("id", request.params.id).eq("clinic_id", access.clinicId).select("*").single();
    if (error) throw error; return { appointment: data };
  });

  app.get("/v1/procedures", { preHandler: requireUser }, async (request) => {
    const access = await getClinicAccess((request as AuthenticatedRequest).userId); requirePermission(access, "procedures");
    const { data, error } = await database.from("procedures").select("id,name,category,description,internal_code,duration_minutes,price,color,active,created_at").eq("clinic_id", access.clinicId).order("active", { ascending: false }).order("name");
    if (error) throw error; return { procedures: data || [] };
  });

  app.post<{ Body: Record<string, unknown> }>("/v1/procedures", { preHandler: requireUser }, async (request, reply) => {
    const access = await getClinicAccess((request as AuthenticatedRequest).userId); requirePermission(access, "procedures");
    const fields = ["name", "category", "description", "internal_code", "duration_minutes", "price", "color", "active"];
    const { data, error } = await database.from("procedures").insert({ clinic_id: access.clinicId, ...clean(request.body, fields) }).select("*").single();
    if (error) throw error; return reply.status(201).send({ procedure: data });
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>("/v1/procedures/:id", { preHandler: requireUser }, async (request) => {
    const access = await getClinicAccess((request as AuthenticatedRequest).userId); requirePermission(access, "procedures");
    const fields = ["name", "category", "description", "internal_code", "duration_minutes", "price", "color", "active"];
    const { data, error } = await database.from("procedures").update(clean(request.body, fields)).eq("id", request.params.id).eq("clinic_id", access.clinicId).select("*").single();
    if (error) throw error; return { procedure: data };
  });

  app.delete<{ Params: { id: string } }>("/v1/procedures/:id", { preHandler: requireUser }, async (request, reply) => {
    const access = await getClinicAccess((request as AuthenticatedRequest).userId); requirePermission(access, "procedures");
    const { error } = await database.from("procedures").delete().eq("id", request.params.id).eq("clinic_id", access.clinicId);
    if (error) throw error; return reply.status(204).send();
  });
}
