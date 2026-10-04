import { randomBytes } from "node:crypto";
import { config } from "../config.js";
import { firebaseAuth } from "../firebase.js";
import { database } from "../supabase.js";

const frontendUrl = process.env.FRONTEND_URL || config.allowedOrigin.split(",")[0];

async function sendReset(email: string, link: string) {
  if (!config.resendApiKey || !config.emailFrom) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [email],
      subject: "Defina sua senha de acesso à Medix",
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h1 style="color:#7155e8">Seu acesso Medix foi atualizado</h1><p>Para continuar usando a plataforma, defina uma nova senha.</p><p><a href="${link}" style="display:inline-block;background:#7155e8;color:#fff;padding:12px 18px;border-radius:7px;text-decoration:none">Definir nova senha</a></p></div>`,
    }),
  });
  return response.ok;
}

let page = 1; let imported = 0; let existing = 0; let notified = 0;
while (true) {
  const result = await database.auth.admin.listUsers({ page, perPage: 1000 });
  if (result.error) throw result.error;
  for (const user of result.data.users) {
    if (!user.email) continue;
    try {
      await firebaseAuth.getUser(user.id);
      existing += 1;
      continue;
    } catch (error) {
      if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
    }
    const { data: profile } = await database.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    await firebaseAuth.createUser({
      uid: user.id,
      email: user.email,
      displayName: profile?.full_name || String(user.user_metadata?.full_name || ""),
      password: randomBytes(24).toString("base64url"),
      emailVerified: Boolean(user.email_confirmed_at),
    });
    imported += 1;
    const link = await firebaseAuth.generatePasswordResetLink(user.email, { url: `${frontendUrl.replace(/\/$/, "")}/auth` });
    if (await sendReset(user.email, link)) notified += 1;
  }
  if (result.data.users.length < 1000) break;
  page += 1;
}

console.log(JSON.stringify({ imported, existing, notified, warning: notified < imported ? "Configure RESEND_API_KEY e EMAIL_FROM ou envie a redefinição pelo console Firebase aos usuários não notificados." : undefined }, null, 2));
