import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";
const { database } = await import("../src/supabase.js");
const { requireAgenda, validateRecipients, buildAppointmentNotices } = await import("../src/appointment-notifications.js");
const { registerOperationRoutes } = await import("../src/routes/operations.js");
const clinic = "00000000-0000-4000-8000-000000000001", user = "00000000-0000-4000-8000-000000000002", blocked = "00000000-0000-4000-8000-000000000003";

test("notifications respect reminder boundaries, cancellation and seven-day history", () => {
  const now = Date.parse("2026-10-11T15:00:00Z");
  const row = { id: "appointment", starts_at: "2026-10-11T15:30:00Z", ends_at: "2026-10-11T16:00:00Z", created_at: "2026-10-11T14:00:00Z", status: "scheduled", patients: { full_name: "Paciente teste" }, procedures: { name: "Consulta" } };
  assert.deepEqual(buildAppointmentNotices([row], 30, now).map(n => n.kind), ["upcoming", "created"]);
  assert.equal(buildAppointmentNotices([row], 15, now).length, 1);
  assert.equal(buildAppointmentNotices([{ ...row, status: "cancelled" }], 30, now).length, 0);
  assert.equal(buildAppointmentNotices([{ ...row, status: "completed" }], 30, now).length, 0);
  assert.equal(buildAppointmentNotices([{ ...row, starts_at: new Date(now).toISOString(), created_at: "2026-10-01T14:00:00Z" }], 30, now).length, 0);
  assert.notEqual(buildAppointmentNotices([row], 60, now)[0].id, buildAppointmentNotices([{ ...row, starts_at: "2026-10-11T15:40:00Z" }], 60, now)[0].id);
});

test("recipient validation and feed reject cross-clinic and unauthorized access", async () => {
  const originalFrom = database.from, originalUser = database.auth.getUser;
  let agenda = true, active = true;
  const filtersSeen: Record<string, unknown>[] = [];
  database.auth.getUser = (async () => ({ data: { user: { id: user } }, error: null })) as typeof database.auth.getUser;
  database.from = ((table: string) => {
    const filters: Record<string, unknown> = {}; let selection = "";
    const builder = {
      select(value: string) { selection = value; return builder; },
      eq(key: string, value: unknown) { filters[key] = value; return builder; },
      contains(key: string, value: unknown) { filters[key] = value; return builder; },
      in() { return builder; }, or() { return builder; }, order() { return builder; }, limit() { return builder; },
      then(resolve: (value: unknown) => unknown) {
        if (table === "appointments") { filtersSeen.push(filters); return Promise.resolve({ data: [], error: null }).then(resolve); }
        const data = selection.includes("clinics!inner")
          ? (filters.clinic_id && filters.clinic_id !== clinic ? [] : [{ clinic_id: clinic, role: "professional", permissions: { agenda }, clinics: { created_at: "2026-10-11", status: active ? "active" : "suspended", enabled_modules: { agenda: true } } }])
          : (filters.clinic_id === clinic ? [{ user_id: user, role: "owner", permissions: {}, profiles: { full_name: "Proprietário" } }, { user_id: blocked, role: "professional", permissions: { agenda: false }, profiles: { full_name: "Restrito" } }] : []);
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    }; return builder;
  }) as typeof database.from;
  const app = Fastify(); await registerOperationRoutes(app);
  try {
    assert.deepEqual(await validateRecipients(clinic, [user, user]), [user]);
    await assert.rejects(validateRecipients(clinic, [blocked]), { statusCode: 400 });
    await assert.rejects(validateRecipients("another-clinic", [user]), { statusCode: 400 });
    await assert.rejects(validateRecipients(clinic, "everyone"), { statusCode: 400 });
    await assert.rejects(validateRecipients(clinic, ["invalid"]), { statusCode: 400 });
    const headers = { authorization: "Bearer test", "x-clinic-id": clinic };
    assert.equal((await app.inject({ url: "/v1/appointment-notifications" })).statusCode, 401);
    assert.equal((await app.inject({ url: "/v1/appointment-notifications?advance=30", headers })).statusCode, 200);
    assert.deepEqual(filtersSeen[0], { clinic_id: clinic, notification_recipients: [user] });
    assert.equal((await app.inject({ url: "/v1/appointment-notifications?advance=999", headers })).statusCode, 400);
    agenda = false;
    assert.equal((await app.inject({ url: "/v1/appointment-notifications", headers })).statusCode, 403);
    agenda = true; active = false;
    assert.equal((await app.inject({ url: "/v1/appointment-notifications", headers })).statusCode, 403);
    assert.equal(filtersSeen.length, 1);
    assert.throws(() => requireAgenda({ clinicId: clinic, role: "owner", permissions: {}, member: {}, clinic: { enabled_modules: { agenda: false } } }), { statusCode: 403 });
  } finally { database.from = originalFrom; database.auth.getUser = originalUser; await app.close(); }
});
