import type { FastifyInstance } from "fastify";
import { getClinicAccess, requirePermission } from "../access.js";
import { requireUser, type AuthenticatedRequest } from "../auth.js";
import { database } from "../supabase.js";
import { requireAgenda, notificationRecipients, validateRecipients, buildAppointmentNotices } from "../appointment-notifications.js";

const clean = (body: Record<string, unknown>, fields: string[]) => Object.fromEntries(fields.filter((key) => key in body).map((key) => [key, body[key]]));

async function validateAppointmentLinks(clinicId: string, payload: Record<string, unknown>) {
  for (const [field, table, column] of [["patient_id", "patients", "id"], ["procedure_id", "procedures", "id"], ["professional_id", "clinic_members", "user_id"]]) {
    if (!payload[field]) continue;
    const { data, error } = await database.from(table).select(column).eq("clinic_id", clinicId).eq(column, payload[field]).maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error("Paciente, procedimento e profissional devem pertencer à clínica."), { statusCode: 400 });
  }
}

export async function registerOperationRoutes(app: FastifyInstance) {
  app.get("/v1/appointments/recipients", { preHandler: requireUser }, async (request) => {
    const access = await getClinicAccess((request as AuthenticatedRequest).userId, false, request.headers["x-clinic-id"]);
    requireAgenda(access);
    return { recipients: await notificationRecipients(access.clinicId) };
  });
  app.get<{ Querystring: { advance?: string } }>("/v1/appointment-notifications", { preHandler: requireUser }, async (request) => {
    const userId = (request as AuthenticatedRequest).userId;
    const access = await getClinicAccess(userId, false, request.headers["x-clinic-id"]); requireAgenda(access);
    const advance = Number(request.query.advance || 30);
    if (![5, 15, 30, 60].includes(advance)) throw Object.assign(new Error("Antecedência inválida."), { statusCode: 400 });
    const now = Date.now(), since = new Date(now - 7 * 86400000).toISOString(), until = new Date(now + advance * 60000).toISOString();
    const { data, error } = await database.from("appointments")
      .select("id,starts_at,ends_at,created_at,status,patients(full_name),procedures(name)")
      .eq("clinic_id", access.clinicId).contains("notification_recipients", [userId])
      .in("status", ["scheduled", "confirmed"])
      .or(`created_at.gte.${since},and(starts_at.gt.${new Date(now).toISOString()},starts_at.lte.${until})`)
      .order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    return { notifications: buildAppointmentNotices(data || [], advance, now) };
  });
  app.get<{ Querystring: { from?: string; to?: string; reminders?: string } }>("/v1/appointments", { preHandler: requireUser }, async (request) => {
    const access = await getClinicAccess((request as AuthenticatedRequest).userId, false, request.headers["x-clinic-id"]); requirePermission(access, "agenda");
    requireAgenda(access);
    const selection = request.query.reminders === "true" ? "id,starts_at,patients(full_name),procedures(name)" : "id,patient_id,procedure_id,professional_id,starts_at,ends_at,status,notes,duration_minutes,notification_recipients,patients(full_name),procedures(name,color)";
    let query = database.from("appointments").select(selection).eq("clinic_id", access.clinicId).order("starts_at");
    if (request.query.from) query = query.gte("starts_at", request.query.from);
    if (request.query.to) query = query.lt("starts_at", request.query.to);
    if (request.query.reminders === "true") query = query.in("status", ["scheduled", "confirmed"]);
    const { data, error } = await query; if (error) throw error; return { appointments: data || [] };
  });

  app.post<{ Body: Record<string, unknown> }>("/v1/appointments", { preHandler: requireUser }, async (request, reply) => {
    const access = await getClinicAccess((request as AuthenticatedRequest).userId, false, request.headers["x-clinic-id"]); requirePermission(access, "agenda");
    requireAgenda(access);
    const fields = ["patient_id", "procedure_id", "professional_id", "starts_at", "ends_at", "status", "notes", "duration_minutes"];
    const payload = clean(request.body, fields);
    if (!payload.patient_id || !payload.starts_at || !payload.ends_at) return reply.status(400).send({ message: "Informe paciente, data e horário." });
    payload.notification_recipients = await validateRecipients(access.clinicId, request.body.notification_recipients ?? []);
    await validateAppointmentLinks(access.clinicId, payload);
    const { data, error } = await database.from("appointments").insert({ clinic_id: access.clinicId, ...payload }).select("*").single();
    if (error) throw error; return reply.status(201).send({ appointment: data });
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>("/v1/appointments/:id", { preHandler: requireUser }, async (request) => {
    const access = await getClinicAccess((request as AuthenticatedRequest).userId, false, request.headers["x-clinic-id"]); requirePermission(access, "agenda");
    const fields = ["starts_at", "ends_at", "status", "notes", "duration_minutes", "patient_id", "procedure_id", "professional_id"];
    requireAgenda(access);
    const payload = clean(request.body, fields);
    if ("notification_recipients" in request.body) payload.notification_recipients = await validateRecipients(access.clinicId, request.body.notification_recipients);
    await validateAppointmentLinks(access.clinicId, payload);
    const { data, error } = await database.from("appointments").update(payload).eq("id", request.params.id).eq("clinic_id", access.clinicId).select("*").single();
    if (error) throw error; return { appointment: data };
  });

  app.get("/v1/procedures", { preHandler: requireUser }, async (request) => {
    const access = await getClinicAccess((request as AuthenticatedRequest).userId, false, request.headers["x-clinic-id"]); requirePermission(access, "procedures");
    const { data, error } = await database.from("procedures").select("id,name,category,description,internal_code,duration_minutes,price,color,active,created_at").eq("clinic_id", access.clinicId).order("active", { ascending: false }).order("name");
    if (error) throw error; return { procedures: data || [] };
  });

  app.post<{ Body: Record<string, unknown> }>("/v1/procedures", { preHandler: requireUser }, async (request, reply) => {
    const access = await getClinicAccess((request as AuthenticatedRequest).userId, false, request.headers["x-clinic-id"]); requirePermission(access, "procedures");
    const fields = ["name", "category", "description", "internal_code", "duration_minutes", "price", "color", "active"];
    const { data, error } = await database.from("procedures").insert({ clinic_id: access.clinicId, ...clean(request.body, fields) }).select("*").single();
    if (error) throw error; return reply.status(201).send({ procedure: data });
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>("/v1/procedures/:id", { preHandler: requireUser }, async (request) => {
    const access = await getClinicAccess((request as AuthenticatedRequest).userId, false, request.headers["x-clinic-id"]); requirePermission(access, "procedures");
    const fields = ["name", "category", "description", "internal_code", "duration_minutes", "price", "color", "active"];
    const { data, error } = await database.from("procedures").update(clean(request.body, fields)).eq("id", request.params.id).eq("clinic_id", access.clinicId).select("*").single();
    if (error) throw error; return { procedure: data };
  });

  app.delete<{ Params: { id: string } }>("/v1/procedures/:id", { preHandler: requireUser }, async (request, reply) => {
    const access = await getClinicAccess((request as AuthenticatedRequest).userId, false, request.headers["x-clinic-id"]); requirePermission(access, "procedures");
    const { error } = await database.from("procedures").delete().eq("id", request.params.id).eq("clinic_id", access.clinicId);
    if (error) throw error; return reply.status(204).send();
  });
}
