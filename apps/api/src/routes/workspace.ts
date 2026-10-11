import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { getClinicAccess } from "../access.js";
import { requireUser, type AuthenticatedRequest } from "../auth.js";
import { database } from "../supabase.js";

export async function registerWorkspaceRoutes(app: FastifyInstance) {
  app.get("/v1/workspace", { preHandler: requireUser }, async (request) => {
    const userId = (request as AuthenticatedRequest).userId;
    const { data: profile, error: profileError } = await database.from("profiles").select("full_name,avatar_url").eq("id", userId).maybeSingle();
    if (profileError) throw profileError;
    const { data: settings, error: settingsError } = await database.from("platform_settings").select("refresh_requested_at").eq("singleton", true).maybeSingle();
    if (settingsError) throw settingsError;
    try {
      const access = await getClinicAccess(userId, true, request.headers["x-clinic-id"]);
      return { profile, workspace: { ...access.clinic, role: access.role, permissions: access.permissions, member_alert_title: access.member.admin_alert_title, member_alert_message: access.member.admin_alert_message, member_alert_level: access.member.admin_alert_level, refresh_requested_at: settings?.refresh_requested_at } };
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) return { profile, workspace: null };
      throw error;
    }
  });

  app.post<{ Body: { name?: string; slug?: string } }>("/v1/clinics", { preHandler: requireUser }, async (request, reply) => {
    const userId = (request as AuthenticatedRequest).userId;
    const name = request.body.name?.trim(); const slug = request.body.slug?.trim();
    if (!name || name.length < 2 || !slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return reply.status(400).send({ message: "Informe nome e endereço válidos." });
    const { data: existing, error: existingError } = await database.from("clinic_members").select("clinic_id").eq("user_id", userId).limit(1).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return reply.status(409).send({ message: "Este usuário já possui uma clínica." });
    const { error: profileError } = await database.from("profiles").upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true });
    if (profileError) throw profileError;
    const { data: clinic, error } = await database.from("clinics").insert({ id: randomUUID(), name, slug, status: "pending" }).select("*").single();
    if (error) throw error;
    const { error: memberError } = await database.from("clinic_members").insert({ clinic_id: clinic.id, user_id: userId, role: "owner" });
    if (memberError) throw memberError;
    return reply.status(201).send({ clinic });
  });
}
