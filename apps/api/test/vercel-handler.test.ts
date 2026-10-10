import assert from "node:assert/strict";
import { test } from "node:test";
import type { VercelRequest, VercelResponse } from "@vercel/node";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";

const { default: handler, requestUrl } = await import("../api/[...path].js");

function request(url: string, query: VercelRequest["query"]): VercelRequest {
  return { method: "GET", url, query, headers: {} } as VercelRequest;
}

test("maps Vercel catch-all query to health without leaking its routing parameter", () => {
  assert.equal(requestUrl(request("/api/health", { "...path": "health" })), "/health");
});

test("maps nested routes, repeated query values and legacy path captures", () => {
  assert.equal(requestUrl(request("/api/v1/admin/clinics", { "...path": ["v1", "admin", "clinics"], search: "Clínica A", tag: ["a", "b"] })), "/v1/admin/clinics?search=Cl%C3%ADnica+A&tag=a&tag=b");
  assert.equal(requestUrl(request("/api/health", { path: "health" })), "/health");
  assert.equal(requestUrl(request("/api/health", {})), "/health");
});

async function invoke(req: VercelRequest) {
  let statusCode = 0;
  let body = "";
  const response = {
    setHeader() {},
    status(code: number) { statusCode = code; return response; },
    send(value: string) { body = value; return response; },
  } as unknown as VercelResponse;
  await handler(req, response);
  return { statusCode, payload: JSON.parse(body) };
}

test("health succeeds through the deployed handler shape", async () => {
  const result = await invoke(request("/api/health", { "...path": "health" }));
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.status, "ok");
});

test("nested admin route reaches authentication instead of returning 404", async () => {
  const result = await invoke(request("/api/v1/admin/clinics", { "...path": "v1/admin/clinics" }));
  assert.equal(result.statusCode, 401);
  assert.equal(result.payload.message, "Sessão não encontrada.");
});
