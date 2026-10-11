import assert from "node:assert/strict";
import { test } from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";
const { database } = await import("../src/supabase.js");
const { resetClinicOwnerPassword } = await import("../src/clinic-owner-password.js");

test("owner password reset validates administrator, clinic membership and protected accounts", async () => {
  const actor = "00000000-0000-4000-8000-000000000001";
  const owner = "00000000-0000-4000-8000-000000000002";
  const clinic = "00000000-0000-4000-8000-000000000003";
  let authorized = true, membership = true, protectedOwner = false, providerFails = false, calls = 0;
  const originalFrom = database.from;
  const originalUpdate = database.auth.admin.updateUserById;
  database.from = ((table: string) => {
    const filters: Record<string, string> = {};
    const builder = {
      select() { return builder; },
      eq(key: string, value: string) { filters[key] = value; return builder; },
      async maybeSingle() {
        const found = table === "platform_admins" ? (filters.user_id === actor ? authorized : protectedOwner)
          : membership && filters.user_id === owner && filters.clinic_id === clinic && filters.role === "owner";
        return { data: found ? { user_id: filters.user_id } : null, error: null };
      },
    };
    return builder;
  }) as typeof database.from;
  database.auth.admin.updateUserById = (async (id, attributes) => {
    calls++;
    assert.equal(id, owner);
    assert.deepEqual(Object.keys(attributes), ["password"]);
    return { data: { user: null }, error: providerFails ? new Error("Provider failure") : null };
  }) as typeof database.auth.admin.updateUserById;
  try {
    await resetClinicOwnerPassword(actor, clinic, owner, "StrongPassword123");
    assert.equal(calls, 1);
    authorized = false;
    await assert.rejects(resetClinicOwnerPassword(actor, clinic, owner, "StrongPassword123"), { statusCode: 403 });
    authorized = true;
    await assert.rejects(resetClinicOwnerPassword(actor, clinic, owner, "weak"), { statusCode: 400 });
    await assert.rejects(resetClinicOwnerPassword(actor, clinic, null, "StrongPassword123"), { statusCode: 400 });
    await assert.rejects(resetClinicOwnerPassword(actor, clinic, actor, "StrongPassword123"), { statusCode: 403 });
    membership = false;
    await assert.rejects(resetClinicOwnerPassword(actor, clinic, owner, "StrongPassword123"), { statusCode: 404 });
    membership = true;
    await assert.rejects(resetClinicOwnerPassword(actor, "other-clinic", owner, "StrongPassword123"), { statusCode: 404 });
    protectedOwner = true;
    await assert.rejects(resetClinicOwnerPassword(actor, clinic, owner, "StrongPassword123"), { statusCode: 403 });
    assert.equal(calls, 1);
    protectedOwner = false; providerFails = true;
    await assert.rejects(resetClinicOwnerPassword(actor, clinic, owner, "StrongPassword123"), { statusCode: 400 });
  } finally {
    database.from = originalFrom;
    database.auth.admin.updateUserById = originalUpdate;
  }
});
