import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendKey = process.env.RESEND_API_KEY;
const sender = process.env.EMAIL_FROM;
type Body = { email?: string; password?: string; role?: "admin" | "professional" | "receptionist"; permissions?: Record<string, boolean> };
const allowedRoles = ["admin", "professional", "receptionist"] as const;
const permissionKeys = ["patients", "anamnesis", "records", "history", "agenda", "procedures", "team", "financial", "reports"] as const;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character] || character);

export async function POST(request: NextRequest) {
  if (!url || !anonKey || !serviceRoleKey) return NextResponse.json({ message: "A criação de acessos ainda não foi configurada. Adicione SUPABASE_SERVICE_ROLE_KEY nas variáveis do projeto." }, { status: 503 });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ message: "Sessão não encontrada. Entre novamente." }, { status: 401 });
  const body = await request.json() as Body; const email = body.email?.trim().toLowerCase(); const password = body.password;
  if (!email || !/^\S+@\S+\.\S+$/.test(email) || !password || password.length < 8 || !body.role || !allowedRoles.includes(body.role) || !body.permissions) return NextResponse.json({ message: "Informe e-mail, senha de ao menos 8 caracteres, função e permissões válidas." }, { status: 400 });
  const permissions = Object.fromEntries(permissionKeys.map((key) => [key, body.permissions?.[key] === true]));
  const memberClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: identity, error: identityError } = await memberClient.auth.getUser(token);
  if (identityError || !identity.user) return NextResponse.json({ message: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  const { error: inviteError } = await memberClient.rpc("invite_clinic_member", { invited_email: email, invited_role: body.role, invited_permissions: permissions });
  if (inviteError) return NextResponse.json({ message: inviteError.message }, { status: 403 });
  const adminClient = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: createError } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError) {
    if (/already|registered|exists/i.test(createError.message)) return NextResponse.json({ message: "A conta já existia. As permissões foram atualizadas para esta clínica." });
    return NextResponse.json({ message: createError.message }, { status: 400 });
  }
  const loginUrl = new URL("/auth", request.url).toString();
  if (!resendKey || !sender) return NextResponse.json({ message: "Acesso criado. Compartilhe o login e a senha definidos com o colaborador." }, { status: 201 });
  const emailResponse = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: sender, to: [email], subject: "Seu acesso à Medix foi criado", html: `<div style="font-family:Arial,sans-serif;color:#25212d;max-width:560px;margin:auto"><h1 style="color:#7155e8">Bem-vindo(a) à Medix</h1><p>Seu acesso à clínica foi criado. Use estas informações para entrar:</p><p><b>E-mail:</b> ${escapeHtml(email)}<br/><b>Senha:</b> ${escapeHtml(password)}</p><p><a href="${loginUrl}" style="display:inline-block;background:#7155e8;color:white;padding:12px 18px;border-radius:7px;text-decoration:none;font-weight:bold">Entrar na Medix</a></p><p>Se você não esperava este convite, ignore esta mensagem.</p></div>` }) });
  if (!emailResponse.ok) return NextResponse.json({ message: "Acesso criado, mas o e-mail não pôde ser enviado. Compartilhe o login e a senha manualmente." }, { status: 202 });
  return NextResponse.json({ message: "Acesso criado e enviado por e-mail." }, { status: 201 });
}
