import type { IncomingHttpHeaders } from "node:http";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { InjectOptions } from "light-my-request";
import { buildApp } from "../src/app.js";

const appPromise = buildApp().then(async (app) => {
  await app.ready();
  return app;
});

export function requestUrl(request: VercelRequest) {
  // The rewrite supplies "path"; keep support for legacy catch-all captures.
  const capturedPath = request.query["...path"] ?? request.query.path;
  const path = Array.isArray(capturedPath) ? capturedPath.join("/") : capturedPath;
  const originalUrl = new URL(request.url || "/", "http://localhost");
  const pathname = path
    ? `/${path}`
    : originalUrl.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(request.query)) {
    if (key === "path" || key === "...path") continue;
    for (const item of Array.isArray(value) ? value : [value]) if (item !== undefined) query.append(key, item);
  }
  const suffix = query.toString();
  return `${pathname}${suffix ? `?${suffix}` : ""}`;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const app = await appPromise;
  const options: InjectOptions = {
    method: (request.method || "GET") as InjectOptions["method"],
    url: requestUrl(request),
    headers: request.headers as IncomingHttpHeaders,
    payload: request.body === undefined ? undefined : typeof request.body === "string" ? request.body : JSON.stringify(request.body),
  };
  const result = await app.inject(options);

  for (const [name, value] of Object.entries(result.headers)) {
    if (value !== undefined && !["content-length", "transfer-encoding", "connection"].includes(name.toLowerCase())) response.setHeader(name, value);
  }
  response.status(result.statusCode).send(result.body || undefined);
}
