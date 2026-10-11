import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";
const { database } = await import("../src/supabase.js");
const { registerClinicDataRoutes } = await import("../src/routes/clinic-data.js");
const { hasPermission } = await import("../src/access.js");
const clinic = "00000000-0000-4000-8000-000000000001", patient = "00000000-0000-4000-8000-000000000002";

test("clinical reads and writes enforce individual rights, modules and patient clinic ownership", async () => {
  const originalFrom = database.from, originalUser = database.auth.getUser;
  let owner = false, moduleEnabled = true, ownPatient = true;
  let permissions: Record<string, boolean> = { patients: true, anamnesis: false, records: false, history: true };
  const reads: string[] = [], writes: { table: string; payload: Record<string, unknown> }[] = [];
  database.auth.getUser = (async () => ({ data: { user: { id: "test-user" } }, error: null })) as typeof database.auth.getUser;
  database.from = ((table: string) => {
    const filters: Record<string, unknown> = {}; let selection = "", single = false;
    const builder = {
      select(value: string) { selection = value; return builder; },
      eq(key: string, value: unknown) { filters[key] = value; return builder; },
      order() { return builder; }, limit() { return builder; },
      maybeSingle() { single = true; return builder; },
      upsert(payload: Record<string, unknown>) { writes.push({ table, payload }); return builder; },
      insert(payload: Record<string, unknown>) { writes.push({ table, payload }); return builder; },
      then(resolve: (value: unknown) => unknown) {
        let data: unknown;
        if (selection.includes("clinics!inner")) data = filters.clinic_id !== clinic ? [] : [{ clinic_id: clinic, role: owner ? "owner" : "professional", permissions, clinics: { status: "active", created_at: "2026-10-11", enabled_modules: { patients: moduleEnabled, agenda: true } } }];
        else {
          reads.push(table);
          if (table === "patients") data = ownPatient && filters.clinic_id === clinic && filters.id === patient ? { id: patient } : null;
          else if (table === "patient_anamnesis") data = single ? { main_complaint: "Queixa de teste" } : null;
          else if (table === "patient_clinical_records") data = [{ id: "record", content: "Evolução de teste" }];
          else if (table === "appointments") data = [{ starts_at: "2026-10-11T15:00:00Z", status: "scheduled" }];
        }
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    }; return builder;
  }) as typeof database.from;
  const app = Fastify(); await registerClinicDataRoutes(app);
  const headers = { authorization: "Bearer test", "x-clinic-id": clinic };
  const url = `/v1/patients/${patient}`;
  try {
    let response = await app.inject({ url: `${url}/details`, headers });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().anamnesis, null); assert.deepEqual(response.json().records, []);
    assert.equal(response.json().history.length, 1);
    assert.deepEqual(reads, ["patients", "appointments"]);
    assert.equal((await app.inject({ method: "PUT", url: `${url}/anamnesis`, headers, payload: { main_complaint: "teste" } })).statusCode, 403);
    assert.equal((await app.inject({ method: "POST", url: `${url}/records`, headers, payload: { content: "teste" } })).statusCode, 403);
    assert.equal(writes.length, 0);
    permissions = { patients: true, anamnesis: true, records: true, history: true };
    reads.length = 0;
    response = await app.inject({ url: `${url}/details`, headers });
    assert.equal(response.statusCode, 200); assert.equal(response.json().anamnesis.main_complaint, "Queixa de teste");
    assert.equal(response.json().records.length, 1);
    assert.equal((await app.inject({ method: "PUT", url: `${url}/anamnesis`, headers, payload: { main_complaint: "teste" } })).statusCode, 200);
    assert.equal((await app.inject({ method: "POST", url: `${url}/records`, headers, payload: { content: "teste" } })).statusCode, 201);
    assert.equal(writes[0].payload.clinic_id, clinic); assert.equal(writes[0].payload.patient_id, patient);
    ownPatient = false;
    assert.equal((await app.inject({ url: `${url}/details`, headers })).statusCode, 404);
    assert.equal((await app.inject({ method: "PUT", url: `${url}/anamnesis`, headers, payload: {} })).statusCode, 404);
    assert.equal((await app.inject({ method: "POST", url: `${url}/records`, headers, payload: { content: "teste" } })).statusCode, 404);
    assert.equal(writes.length, 2);
    ownPatient = true; owner = true; moduleEnabled = false;
    assert.equal((await app.inject({ url: `${url}/details`, headers })).statusCode, 403);
    assert.equal((await app.inject({ url: "/v1/dashboard", headers })).json().patients.length, 0);
    moduleEnabled = true;
    assert.equal((await app.inject({ url: `${url}/details`, headers: { ...headers, "x-clinic-id": "00000000-0000-4000-8000-000000000099" } })).statusCode, 403);
    assert.equal(hasPermission({ clinicId: clinic, role: "owner", member: {}, permissions: {}, clinic: { enabled_modules: { team: false } } }, "team"), false);
  } finally { database.from = originalFrom; database.auth.getUser = originalUser; await app.close(); }
});
