import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { database } from "../supabase.js";
import { getClinicAccess, requirePermission } from "../access.js";
import { requireUser, type AuthenticatedRequest } from "../auth.js";

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
    const access = await getClinicAccess((request as AuthenticatedRequest).userId, false, request.headers["x-clinic-id"]); requirePermission(access, "team");
    const [{ data: members, error }, { data: invites, error: inviteError }] = await Promise.all([
      database.from("clinic_members").select("user_id,role,permissions,admin_alert_title,admin_alert_message,admin_alert_level,profiles(full_name,created_at)").eq("clinic_id", access.clinicId),
      database.from("clinic_invites").select("id,email,role,permissions,status,created_at").eq("clinic_id", access.clinicId).eq("status", "pending"),
    ]);
    if (error) throw error; if (inviteError) throw inviteError;
    const emails = new Map<string, string>();
    // Leia somente contas vinculadas à clínica, sem listar toda a plataforma.
    for (let offset = 0; offset < (members || []).length; offset += 10) {
      await Promise.all((members || []).slice(offset, offset + 10).map(async member => {
        const result = await database.auth.admin.getUserById(member.user_id);
        if (result.error) throw result.error;
        emails.set(member.user_id, result.data.user?.email || "");
      }));
    }
    return { members: [
      ...(members || []).map((member) => ({ ...member, member_role: member.role, email: emails.get(member.user_id) || "", full_name: (member.profiles as unknown as { full_name?: string })?.full_name || "", status: "active" })),
      ...(invites || []).map((invite) => ({ invite_id: invite.id, user_id: null, full_name: "", email: invite.email, member_role: invite.role, role: invite.role, permissions: invite.permissions, status: invite.status, created_at: invite.created_at })),
    ] };
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>("/v1/team/:id", { preHandler: requireUser }, async (request) => {
    const currentUser = (request as AuthenticatedRequest).userId; const access = await getClinicAccess(currentUser, false, request.headers["x-clinic-id"]); requirePermission(access, "team");
    if (request.params.id === currentUser) throw Object.assign(new Error("Não altere seu próprio acesso por esta tela."), { statusCode: 400 });
    const target = await database.from("clinic_members").select("role").eq("clinic_id", access.clinicId).eq("user_id", request.params.id).maybeSingle();
    if (target.error) throw target.error;
    if (!target.data) throw Object.assign(new Error("Colaborador não encontrado nesta clínica."), { statusCode: 404 });
    if (target.data.role === "owner") throw Object.assign(new Error("O acesso do proprietário não pode ser alterado por esta tela."), { statusCode: 403 });
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

    const access = await getClinicAccess((request as AuthenticatedRequest).userId, false, request.headers["x-clinic-id"]); requirePermission(access, "team");

    // Usa a clínica selecionada e validada pela API, sem uma RPC que escolhe
    // implicitamente o primeiro workspace da conta.
    let targetUser: string | undefined;
    for (let page = 1; !targetUser; page++) {
      const result = await database.auth.admin.listUsers({ page, perPage: 1000 });
      if (result.error) throw result.error;
      targetUser = result.data.users.find(user => user.email?.toLowerCase() === email)?.id;
      if (result.data.users.length < 1000) break;
    }
    const existed = Boolean(targetUser);
    if (!targetUser) {
      const { data, error } = await database.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) return reply.status(400).send({ message: error.message });
      targetUser = data.user.id;
    }
    if (existed) {
      const target = await database.from("clinic_members").select("role").eq("clinic_id", access.clinicId).eq("user_id", targetUser).maybeSingle();
      if (target.error) throw target.error;
      if (target.data?.role === "owner" || targetUser === (request as AuthenticatedRequest).userId) throw Object.assign(new Error("Não altere o acesso do proprietário ou seu próprio acesso por esta tela."), { statusCode: 403 });
    }
    const { error: memberError } = await database.from("clinic_members").upsert({ clinic_id: access.clinicId, user_id: targetUser, role, permissions }, { onConflict: "clinic_id,user_id" });
    if (memberError) throw memberError;
    if (existed) return { message: "A conta já existia. O acesso foi atualizado nesta clínica; a senha atual foi mantida." };

    const loginUrl = `${config.allowedOrigin.split(",")[0].replace(/\/$/, "")}/auth`;
    const sent = await sendAccessEmail(email, password, loginUrl);
    return reply.status(201).send({ message: sent ? "Acesso criado e enviado por e-mail." : "Acesso criado. Compartilhe o login e a senha com o colaborador." });
  });
}
