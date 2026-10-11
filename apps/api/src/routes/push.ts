import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import webpush from "web-push";
import type { FastifyInstance } from "fastify";
import { requireUser, type AuthenticatedRequest } from "../auth.js";
import { getClinicAccess } from "../access.js";
import { requireAgenda } from "../appointment-notifications.js";
import { database } from "../supabase.js";

const configured = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT && process.env.PUSH_CRON_SECRET);
const hash = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex");
export function validatePushSubscription(value: unknown): webpush.PushSubscription {
  const s = value as webpush.PushSubscription | undefined;
  let url: URL;
  try { url = new URL(s?.endpoint || ""); } catch { throw Object.assign(new Error("Inscrição push inválida."), { statusCode: 400 }); }
  // Não aceite destinos arbitrários: evita SSRF usando o serviço de push.
  const allowed = ["fcm.googleapis.com", "fcm-notifications.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];
  if (url.protocol !== "https:" || url.port || url.username || url.password || !allowed.includes(url.hostname) || !s?.keys || !/^[A-Za-z0-9_-]{87,88}={0,2}$/.test(s.keys.p256dh) || !/^[A-Za-z0-9_-]{22,24}={0,2}$/.test(s.keys.auth) || s.endpoint.length > 2048) {
    throw Object.assign(new Error("Inscrição push inválida ou navegador não suportado."), { statusCode: 400 });
  }
  return { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
}
export function validCronSignature(header: unknown, secret: string | undefined, now = Date.now()) {
  if (!secret || typeof header !== "string") return false;
  const match = /^Bearer (\d{10})\.([a-f0-9]{64})$/.exec(header);
  if (!match || Math.abs(now / 1000 - Number(match[1])) > 90) return false;
  const expected = createHmac("sha256", secret).update(`medix-push:${match[1]}`).digest();
  return timingSafeEqual(expected, Buffer.from(match[2], "hex"));
}
export async function registerPushRoutes(app: FastifyInstance) {
  app.get("/v1/push/config", { preHandler: requireUser }, async () => ({ enabled: configured(), publicKey: configured() ? process.env.VAPID_PUBLIC_KEY : null }));
  app.post<{ Body: { subscription?: unknown; advance?: number } }>("/v1/push/subscriptions", { preHandler: requireUser }, async (request, reply) => {
    const userId = (request as AuthenticatedRequest).userId;
    const access = await getClinicAccess(userId, false, request.headers["x-clinic-id"]); requireAgenda(access);
    if (!configured()) return reply.status(503).send({ message: "Push ainda não foi configurado no servidor. Os avisos do sino continuam funcionando." });
    const subscription = validatePushSubscription(request.body.subscription);
    const advance = request.body.advance ?? 30;
    if (![5,15,30,60].includes(advance)) return reply.status(400).send({ message: "Antecedência inválida." });
    const endpointHash = hash(subscription.endpoint);
    const existing = await database.from("push_subscriptions").select("user_id,clinic_id,created_at").eq("endpoint_hash", endpointHash).maybeSingle();
    if (existing.error) throw existing.error;
    const createdAt = existing.data?.user_id === userId && existing.data?.clinic_id === access.clinicId ? existing.data.created_at : new Date().toISOString();
    const { error } = await database.from("push_subscriptions").upsert({ endpoint_hash: endpointHash, user_id: userId, clinic_id: access.clinicId, subscription, advance_minutes: advance, created_at: createdAt, updated_at: new Date().toISOString() }, { onConflict: "endpoint_hash" });
    if (error) throw error;
    return reply.status(204).send();
  });
  app.delete<{ Body: { endpoint?: string } }>("/v1/push/subscriptions", { preHandler: requireUser }, async (request, reply) => {
    if (typeof request.body?.endpoint !== "string") return reply.status(400).send({ message: "Inscrição inválida." });
    const { error } = await database.from("push_subscriptions").delete().eq("user_id", (request as AuthenticatedRequest).userId).eq("endpoint_hash", hash(request.body.endpoint));
    if (error) throw error;
    return reply.status(204).send();
  });
  app.post("/internal/push/dispatch", async (request, reply) => {
    if (!validCronSignature(request.headers.authorization, process.env.PUSH_CRON_SECRET)) return reply.status(401).send({ message: "Não autorizado." });
    if (!configured()) return reply.status(503).send({ message: "Push não configurado." });
    const { data, error } = await database.rpc("claim_push_deliveries"); if (error) throw error;
    const rows = (data || []) as { subscription_id: string; event_key: string; kind: string; subscription: webpush.PushSubscription }[];
    // No máximo cinco envios simultâneos, com timeout e até cinco tentativas pela fila.
    for (let offset = 0; offset < rows.length; offset += 5) {
      await Promise.all(rows.slice(offset, offset + 5).map(async row => {
        let status = "sent";
        try {
          const subscription = validatePushSubscription(row.subscription);
          await webpush.sendNotification(subscription, JSON.stringify({ title: row.kind === "upcoming" ? "Um agendamento está próximo" : "Novo agendamento na Medix", body: "Abra a Medix para consultar os detalhes com segurança.", tag: row.event_key }), { TTL: 120, timeout: 4000, vapidDetails: { subject: process.env.VAPID_SUBJECT!, publicKey: process.env.VAPID_PUBLIC_KEY!, privateKey: process.env.VAPID_PRIVATE_KEY! } });
        } catch (caught) {
          const code = (caught as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            const { error } = await database.from("push_subscriptions").delete().eq("id", row.subscription_id); if (error) throw error;
            return;
          }
          status = code === 400 ? "failed" : "pending";
        }
        const { error } = await database.from("push_deliveries").update({ status, retry_at: new Date(Date.now() + 120000).toISOString() }).eq("subscription_id", row.subscription_id).eq("event_key", row.event_key);
        if (error) throw error;
      }));
    }
    return reply.status(204).send();
  });
}
