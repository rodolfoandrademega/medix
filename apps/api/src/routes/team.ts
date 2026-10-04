import { createClient } from "@supabase/supabase-js";
import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { database } from "../supabase.js";
import { getClinicAccess, requirePermission } from "../access.js";
import { requireUser, type AuthenticatedRequest } from "../auth.js";
import { firebaseAuth } from "../firebase.js";
import { randomUUID } from "node:crypto";

const roles = ["admin", "professional", "receptionist"] as const;
const permissionKeys = ["patients", "anamnesis", "records", "history", "agenda", "procedures", "team", "financial", "reports"] as const;

type Input = {
  email?: string;
  password?: string;
  role?: typeof roles[number];
  permissions?: Record<string, boolean>;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character] || character);
}

async function sendAccessEmail(email: string, password: string, loginUrl: string) {
  if (!config.resendApiKey || !config.emailFrom) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [email],
      subject: "Seu acesso à Medix foi criado",
      html: `<div style="font-family:Arial,sans-serif;color:#25212d;max-width:560px;margin:auto"><h1 style="color:#7155e8">Bem-vindo(a) à Medix</h1><p>Seu acesso à clínica foi criado.</p><p><b>E-mail:</b> ${escapeHtml(email)}<br/><b>Senha:</b> ${escapeHtml(password)}</p><p><a href="${escapeHtml(loginUrl)}">Entrar na Medix</a></p></div>`,
    }),
  });
  return response.ok;
}

export async function registerTeamRoutes(app: FastifyInstance) {
  app.get("/v1/team", { preHandler: requireUser }, async (request) => {
    const access = await getClinicAccess((request as AuthenticatedRequest).userId); requirePermission(access, "team");
    const [{ data: members, error }, { data: invites, error: inviteError }] = await Promise.all([
      database.from("clinic_members").select("user_id,role,permissions,admin_alert_title,admin_alert_message,admin_alert_level,profiles(full_name,created_at)").eq("clinic_id", access.clinicId),
      database.from("clinic_invites").select("id,email,role,permissions,status,created_at").eq("clinic_id", access.clinicId).eq("status", "pending"),
    ]);
    if (error) throw error; if (inviteError) throw inviteError;
    const emails = new Map<string, string>();
    if (config.authProvider === "firebase") {
      const users = await firebaseAuth.listUsers(1000);
      users.users.forEach((user) => emails.set(user.uid, user.email || ""));
    } else {
      const users = await database.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (users.error) throw users.error;
      users.data.users.forEach((user) => emails.set(user.id, user.email || ""));
    }
    return { members: [
      ...(members || []).map((member) => ({ ...member, member_role: member.role, email: emails.get(member.user_id) || "", full_name: (member.profiles as unknown as { full_name?: string })?.full_name || "", status: "active" })),
      ...(invites || []).map((invite) => ({ invite_id: invite.id, user_id: null, full_name: "", email: invite.email, member_role: invite.role, role: invite.role, permissions: invite.permissions, status: invite.status, created_at: invite.created_at })),
    ] };
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>("/v1/team/:id", { preHandler: requireUser }, async (request) => {
    const currentUser = (request as AuthenticatedRequest).userId; const access = await getClinicAccess(currentUser); requirePermission(access, "team");
    if (request.params.id === currentUser) throw Object.assign(new Error("Não altere seu próprio acesso por esta tela."), { statusCode: 400 });
    const role = typeof request.body.role === "string" && roles.includes(request.body.role as typeof roles[number]) ? request.body.role : "professional";
    const permissions = request.body.permissions && typeof request.body.permissions === "object" ? Object.fromEntries(permissionKeys.map((key) => [key, (request.body.permissions as Record<string, unknown>)[key] === true])) : {};
    const level = ["info", "warning", "important"].includes(String(request.body.admin_alert_level)) ? request.body.admin_alert_level : "info";
    const { error } = await database.from("clinic_members").update({ role, permissions, admin_alert_title: request.body.admin_alert_title || null, admin_alert_message: request.body.admin_alert_message || null, admin_alert_level: level }).eq("clinic_id", access.clinicId).eq("user_id", request.params.id);
    if (error) throw error; return { message: "Acesso e alerta do colaborador atualizados." };
  });

  app.post<{ Body: Input }>("/v1/team/access", { preHandler: requireUser }, async (request, reply) => {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return reply.status(401).send({ message: "Sessão não encontrada. Entre novamente." });

    const email = request.body.email?.trim().toLowerCase();
    const password = request.body.password;
    const role = request.body.role;
    if (!email || !/^\S+@\S+\.\S+$/.test(email) || !password || password.length < 8 || !role || !roles.includes(role) || !request.body.permissions) {
      return reply.status(400).send({ message: "Informe e-mail, senha de ao menos 8 caracteres, função e permissões válidas." });
    }
    const permissions = Object.fromEntries(permissionKeys.map((key) => [key, request.body.permissions?.[key] === true]));

    const access = await getClinicAccess((request as AuthenticatedRequest).userId); requirePermission(access, "team");

    if (config.authProvider === "firebase") {
      const uid = randomUUID();
      try {
        await firebaseAuth.createUser({ uid, email, password, emailVerified: true });
        const { error: profileError } = await database.from("profiles").insert({ id: uid, full_name: "" });
        if (profileError) { await firebaseAuth.deleteUser(uid); throw profileError; }
        const { error: memberError } = await database.from("clinic_members").insert({ clinic_id: access.clinicId, user_id: uid, role, permissions });
        if (memberError) { await database.from("profiles").delete().eq("id", uid); await firebaseAuth.deleteUser(uid); throw memberError; }
        const loginUrl = `${config.allowedOrigin.split(",")[0].replace(/\/$/, "")}/auth`;
        const sent = await sendAccessEmail(email, password, loginUrl);
        return reply.status(201).send({ message: sent ? "Acesso criado e enviado por e-mail." : "Acesso criado. Compartilhe o login e a senha com o colaborador." });
      } catch (error) {
        if ((error as { code?: string }).code === "auth/email-already-exists") return reply.status(409).send({ message: "Já existe uma conta com este e-mail no Firebase." });
        throw error;
      }
    }

    // Compatibilidade temporária para a produção atual com Supabase Auth.
    const memberClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: inviteError } = await memberClient.rpc("invite_clinic_member", {
      invited_email: email,
      invited_role: role,
      invited_permissions: permissions,
    });
    if (inviteError) return reply.status(403).send({ message: inviteError.message });

    const { error: createError } = await database.auth.admin.createUser({ email, password, email_confirm: true });
    if (createError) {
      if (/already|registered|exists/i.test(createError.message)) return { message: "A conta já existia. As permissões foram atualizadas para esta clínica." };
      return reply.status(400).send({ message: createError.message });
    }

    const loginUrl = `${config.allowedOrigin.split(",")[0].replace(/\/$/, "")}/auth`;
    const sent = await sendAccessEmail(email, password, loginUrl);
    return reply.status(201).send({ message: sent ? "Acesso criado e enviado por e-mail." : "Acesso criado. Compartilhe o login e a senha com o colaborador." });
  });
}
