import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";
const { database } = await import("../src/supabase.js");
const { registerTeamRoutes } = await import("../src/routes/team.js");

test("team reads only linked accounts and protects owner, self and other clinics", async () => {
  const clinic = "00000000-0000-4000-8000-000000000001";
  const originalFrom = database.from, originalUser = database.auth.getUser;
  const originalLookup = database.auth.admin.getUserById, originalList = database.auth.admin.listUsers;
  let moduleEnabled = true, permission = true;
  const lookups: string[] = [], writes: Record<string, unknown>[] = [];
  database.auth.getUser = (async () => ({ data: { user: { id: "actor" } }, error: null })) as typeof database.auth.getUser;
  database.auth.admin.getUserById = (async (id: string) => { lookups.push(id); return { data: { user: { id, email: "test@example.test" } }, error: null }; }) as typeof database.auth.admin.getUserById;
  database.auth.admin.listUsers = (async () => { throw new Error("Não liste contas de toda a plataforma ao ler equipe."); }) as typeof database.auth.admin.listUsers;
  database.from = ((table: string) => {
    const filters: Record<string, unknown> = {}; let selection = "", single = false;
    const builder = {
      select(value: string) { selection = value; return builder; }, eq(key: string, value: unknown) { filters[key] = value; return builder; },
      maybeSingle() { single = true; return builder; },
      update(value: Record<string, unknown>) { writes.push(value); return builder; },
      then(resolve: (value: unknown) => unknown) {
        let data: unknown = [];
        if (selection.includes("clinics!inner")) data = [{ clinic_id: clinic, role: "professional", permissions: { team: permission }, clinics: { status: "active", created_at: "2026-10-11", enabled_modules: { team: moduleEnabled } } }];
        else if (table === "clinic_members" && single) data = filters.user_id === "outside" ? null : { role: filters.user_id === "owner" ? "owner" : "professional" };
        else if (table === "clinic_members" && selection) data = [{ user_id: "linked", role: "professional", profiles: { full_name: "Teste" } }];
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    }; return builder;
  }) as typeof database.from;
  const app = Fastify(); await registerTeamRoutes(app);
  const headers = { authorization: "Bearer test", "x-clinic-id": clinic };
  const patch = (id: string) => app.inject({ method: "PATCH", url: `/v1/team/${id}`, headers, payload: { role: "professional", permissions: { patients: true } } });
  try {
    assert.equal((await app.inject({ url: "/v1/team", headers })).statusCode, 200);
    assert.deepEqual(lookups, ["linked"]);
    assert.equal((await patch("owner")).statusCode, 403);
    assert.equal((await patch("actor")).statusCode, 400);
    assert.equal((await patch("outside")).statusCode, 404);
    assert.equal(writes.length, 0);
    assert.equal((await patch("linked")).statusCode, 200);
    assert.equal(writes.length, 1);
    moduleEnabled = false;
    assert.equal((await app.inject({ url: "/v1/team", headers })).statusCode, 403);
    moduleEnabled = true; permission = false;
    assert.equal((await patch("linked")).statusCode, 403);
    assert.equal(writes.length, 1);
  } finally {
    database.from = originalFrom; database.auth.getUser = originalUser;
    database.auth.admin.getUserById = originalLookup; database.auth.admin.listUsers = originalList;
    await app.close();
  }
});
