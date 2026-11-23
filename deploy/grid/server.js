import { createServer } from "node:http";
import { jwtVerify } from "jose";
import { readDashboardAsset } from "../../server/dashboard-assets.js";
import registration from "./registration.json" with { type: "json" };

const { id, runtime, access } = registration.agentic_apps.packages[0].manifest;
const { mountPath } = runtime;
const [readScope] = access.tokenScopes;
const issuer = process.env.AGENTIC_APP_TOKEN_ISSUER?.trim() || "caipe-agentic-apps";
const key = Buffer.from(process.env.AGENTIC_APP_TOKEN_SECRET?.trim() || "");
if (key.length < 32) throw new Error("AGENTIC_APP_TOKEN_SECRET must contain at least 32 bytes.");

const port = Number(process.env.PORT || 8080);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT.");

function send(response, status, headers = {}) {
  response.writeHead(status, { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers });
}

const server = createServer(async (request, response) => {
  const path = request.url.split("?")[0];
  if (request.method !== "GET" && request.method !== "HEAD") {
    send(response, 405, { Allow: "GET, HEAD" });
    return response.end();
  }
  if (path === "/healthz") {
    send(response, 200, { "Content-Type": "text/plain; charset=utf-8" });
    return response.end(request.method === "HEAD" ? undefined : "ok\n");
  }

  const token = request.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];
  let identity;
  try {
    if (!token) throw new Error("Missing token.");
    ({ payload: identity } = await jwtVerify(token, key, {
      algorithms: ["HS256"], issuer, audience: `agentic-app:${id}`, requiredClaims: ["exp", "sub"],
    }));
    if (identity.app_id !== id || typeof identity.sub !== "string" || !identity.sub.trim()) throw new Error("Invalid identity.");
  } catch {
    send(response, 401, { "WWW-Authenticate": "Bearer" });
    return response.end();
  }
  if (!Array.isArray(identity.scp) || !identity.scp.includes(readScope)) {
    send(response, 403);
    return response.end();
  }

  try {
    const asset = await readDashboardAsset(path, mountPath);
    if (!asset) {
      send(response, 404);
      return response.end();
    }
    send(response, 200, {
      "Content-Type": asset.type,
      "Content-Length": asset.content.length,
      "Content-Security-Policy": "base-uri 'self'; frame-ancestors 'self'",
    });
    return response.end(request.method === "HEAD" ? undefined : asset.content);
  } catch {
    send(response, 500);
    return response.end();
  }
});

server.listen(port, "0.0.0.0", () => console.log(`Gift Search Grid runtime listening on port ${port}`));
