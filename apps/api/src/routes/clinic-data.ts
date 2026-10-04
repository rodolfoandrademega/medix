import type { FastifyInstance } from "fastify";
import { getClinicAccess, requirePermission } from "../access.js";
import { requireUser, type AuthenticatedRequest } from "../auth.js";
import { database } from "../supabase.js";

const patientFields = "id,full_name,phone,email,preferred_name,birth_date,cpf,gender,occupation,address,address_number,address_complement,neighborhood,city,state,postal_code,emergency_contact_name,emergency_contact_phone,referred_by,notes,created_at";
const allowedPatientFields = patientFields.split(",").filter((field) => !["id", "created_at"].includes(field));
const clean = (body: Record<string, unknown>, fields: string[]) => Object.fromEntries(fields.filter((key) => key in body).map((key) => [key, body[key]]));

export async function registerClinicDataRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { from?: string; to?: string } }>("/v1/dashboard", { preHandler: requireUser }, async (request) => {
    const access = await getClinicAccess((request as AuthenticatedRequest).userId);
    const canPatients = access.role === "owner" || access.permissions.patients === true;
    const canAgenda = access.role === "owner" || access.permissions.agenda === true;
    const patients = canPatients ? await database.from("patients").select(patientFields).eq("clinic_id", access.clinicId).order("created_at", { ascending: false }) : { data: [], error: null };
    let appointmentResult: { data: unknown[] | null; error: unknown } = { data: [], error: null };
    if (canAgenda) {
      let appointments = database.from("appointments").select("id,patient_id,starts_at,status").eq("clinic_id", access.clinicId).order("starts_at");
      if (request.query.from) appointments = appointments.gte("starts_at", request.query.from);
      if (request.query.to) appointments = appointments.lt("starts_at", request.query.to);
      appointmentResult = await appointments;
    }
    if (patients.error) throw patients.error; if (appointmentResult.error) throw appointmentResult.error;
    return { patients: patients.data || [], appointments: appointmentResult.data || [] };
  });

  app.post<{ Body: Record<string, unknown> }>("/v1/patients", { preHandler: requireUser }, async (request, reply) => {
    const access = await getClinicAccess((request as AuthenticatedRequest).userId); requirePermission(access, "patients");
    const payload = clean(request.body, allowedPatientFields);
    if (!payload.full_name) return reply.status(400).send({ message: "Informe o nome do paciente." });
    const { data, error } = await database.from("patients").insert({ clinic_id: access.clinicId, ...payload }).select(patientFields).single();
    if (error) throw error; return reply.status(201).send({ patient: data });
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>("/v1/patients/:id", { preHandler: requireUser }, async (request) => {
    const access = await getClinicAccess((request as AuthenticatedRequest).userId); requirePermission(access, "patients");
    const { data, error } = await database.from("patients").update(clean(request.body, allowedPatientFields)).eq("id", request.params.id).eq("clinic_id", access.clinicId).select(patientFields).single();
    if (error) throw error; return { patient: data };
  });

  app.delete<{ Params: { id: string } }>("/v1/patients/:id", { preHandler: requireUser }, async (request, reply) => {
    const access = await getClinicAccess((request as AuthenticatedRequest).userId); requirePermission(access, "patients");
    const { error } = await database.from("patients").delete().eq("id", request.params.id).eq("clinic_id", access.clinicId);
    if (error) throw error; return reply.status(204).send();
  });

  app.get<{ Params: { id: string } }>("/v1/patients/:id/details", { preHandler: requireUser }, async (request) => {
    const access = await getClinicAccess((request as AuthenticatedRequest).userId); requirePermission(access, "patients");
    const [anamnesis, records, history] = await Promise.all([
      database.from("patient_anamnesis").select("main_complaint,allergies,current_medications,medical_conditions,previous_surgeries,family_history,lifestyle_notes,clinical_observations").eq("clinic_id", access.clinicId).eq("patient_id", request.params.id).maybeSingle(),
      database.from("patient_clinical_records").select("id,title,content,occurred_at").eq("clinic_id", access.clinicId).eq("patient_id", request.params.id).order("occurred_at", { ascending: false }),
      database.from("appointments").select("starts_at,status").eq("clinic_id", access.clinicId).eq("patient_id", request.params.id).order("starts_at", { ascending: false }).limit(12),
    ]);
    if (anamnesis.error) throw anamnesis.error; if (records.error) throw records.error; if (history.error) throw history.error;
    return { anamnesis: anamnesis.data, records: records.data || [], history: history.data || [] };
  });

  app.put<{ Params: { id: string }; Body: Record<string, unknown> }>("/v1/patients/:id/anamnesis", { preHandler: requireUser }, async (request) => {
    const userId = (request as AuthenticatedRequest).userId; const access = await getClinicAccess(userId); requirePermission(access, "anamnesis");
    const fields = ["main_complaint", "allergies", "current_medications", "medical_conditions", "previous_surgeries", "family_history", "lifestyle_notes", "clinical_observations"];
    const { error } = await database.from("patient_anamnesis").upsert({ patient_id: request.params.id, clinic_id: access.clinicId, ...clean(request.body, fields), updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: "patient_id" });
    if (error) throw error; return { message: "Ficha de anamnese salva." };
  });

  app.post<{ Params: { id: string }; Body: { title?: string; content?: string } }>("/v1/patients/:id/records", { preHandler: requireUser }, async (request, reply) => {
    const userId = (request as AuthenticatedRequest).userId; const access = await getClinicAccess(userId); requirePermission(access, "records");
    if (!request.body.content?.trim()) return reply.status(400).send({ message: "Descreva a evolução clínica." });
    const { error } = await database.from("patient_clinical_records").insert({ clinic_id: access.clinicId, patient_id: request.params.id, author_id: userId, title: request.body.title?.trim() || "Evolução clínica", content: request.body.content.trim() });
    if (error) throw error; return reply.status(201).send({ message: "Evolução adicionada ao prontuário." });
  });
}
