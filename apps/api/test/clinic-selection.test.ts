import assert from "node:assert/strict";
import { test } from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";

const { database } = await import("../src/supabase.js");
const { getClinicAccess } = await import("../src/access.js");

test("clinic selection follows the new registration and enforces membership and activation", async () => {
  const oldId = "00000000-0000-4000-8000-000000000001";
  const newId = "00000000-0000-4000-8000-000000000002";
  const rows = [
    { user_id: "account-a", clinic_id: oldId, role: "owner", permissions: {}, clinics: { created_at: "2026-01-01", status: "active" } },
    { user_id: "account-a", clinic_id: newId, role: "owner", permissions: {}, clinics: { created_at: "2026-10-11", status: "pending" } },
  ];
  const original = database.from;
  database.from = (() => {
    const filters: Record<string, string> = {};
    const builder = {
      select() { return builder; },
      eq(key: string, value: string) { filters[key] = value; return builder; },
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve({ data: rows.filter(row => Object.entries(filters).every(([key, value]) => row[key as "user_id" | "clinic_id"] === value)), error: null }).then(resolve);
      },
    };
    return builder;
  }) as typeof database.from;
  try {
    assert.equal((await getClinicAccess("account-a", true)).clinicId, newId);
    await assert.rejects(getClinicAccess("account-a"), { statusCode: 403 });
    assert.equal((await getClinicAccess("account-a", false, oldId)).clinicId, oldId);
    await assert.rejects(getClinicAccess("account-b", true, newId), { statusCode: 403 });
    await assert.rejects(getClinicAccess("account-a", true, "invalid"), { statusCode: 400 });
    rows[1].clinics.status = "active";
    assert.equal((await getClinicAccess("account-a", false, newId)).clinicId, newId);
  } finally { database.from = original; }
});
