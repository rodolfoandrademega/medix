import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import Fastify from "fastify";
import webpush from "web-push";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";
const { validatePushSubscription, validCronSignature, registerPushRoutes } = await import("../src/routes/push.js");

test("push destination validation rejects SSRF and malformed browser keys", () => {
  const keys = { p256dh: webpush.generateVAPIDKeys().publicKey, auth: Buffer.alloc(16).toString("base64url") };
  const subscription = { endpoint: "https://fcm.googleapis.com/fcm/send/test", keys };
  assert.deepEqual(validatePushSubscription(subscription), subscription);
  for (const endpoint of ["http://fcm.googleapis.com/test", "https://127.0.0.1/test", "https://fcm.googleapis.com.evil.example/test", "https://user:pass@fcm.googleapis.com/test", "https://fcm.googleapis.com:8080/test"]) {
    assert.throws(() => validatePushSubscription({ ...subscription, endpoint }), { statusCode: 400 });
  }
  assert.throws(() => validatePushSubscription({ ...subscription, keys: { auth: "bad", p256dh: "bad" } }), { statusCode: 400 });
  assert.throws(() => validatePushSubscription(null), { statusCode: 400 });
});

test("cron requires scope-limited, signed and unexpired authorization", async () => {
  const now = Date.now(), stamp = String(Math.floor(now / 1000)), secret = "test-only-cron-secret";
  const signature = createHmac("sha256", secret).update(`medix-push:${stamp}`).digest("hex");
  assert.equal(validCronSignature(`Bearer ${stamp}.${signature}`, secret, now), true);
  assert.equal(validCronSignature(`Bearer ${stamp}.${signature}`, secret, now + 91000), false);
  assert.equal(validCronSignature(`Bearer ${stamp}.${signature}`, "other-secret", now), false);
  assert.equal(validCronSignature(`Bearer ${stamp}.${signature}`, undefined, now), false);
  assert.equal(validCronSignature("Bearer malformed", secret, now), false);
  const app = Fastify(); await registerPushRoutes(app);
  try {
    assert.equal((await app.inject({ url: "/v1/push/config" })).statusCode, 401);
    assert.equal((await app.inject({ method: "POST", url: "/v1/push/subscriptions", payload: {} })).statusCode, 401);
    assert.equal((await app.inject({ method: "DELETE", url: "/v1/push/subscriptions", payload: {} })).statusCode, 401);
    assert.equal((await app.inject({ method: "POST", url: "/internal/push/dispatch" })).statusCode, 401);
  } finally { await app.close(); }
});
