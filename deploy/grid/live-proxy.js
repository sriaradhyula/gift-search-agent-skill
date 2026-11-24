import { request as upstreamRequest } from "node:http";

const runPath = /^\/api\/runs\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}(?:\/gifts\/[0-4]\/thumbnail\/[0-9a-f]{8})?$/;

export function isLiveRoute(method, path) {
  if (method === "POST") return path === "/api/search" || path === "/api/chat" || path === "/api/session/wipe";
  return method === "GET" && (path === "/api/config" || path === "/api/runs" || runPath.test(path));
}

export function replyJson(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

export function forwardLiveRequest(request, response, target, { token, path, gridAccount }) {
  const headers = {};
  for (const name of ["accept", "content-type", "content-length"]) {
    if (request.headers[name]) headers[name] = request.headers[name];
  }
  if (token) headers.authorization = `Bearer ${token}`;
  if (gridAccount) headers["x-gift-grid-account"] = gridAccount;

  const upstream = upstreamRequest(new URL(path, target), {
    method: request.method, headers, timeout: 190_000,
  }, (result) => {
    const contentType = result.headers["content-type"] ?? "application/json";
    response.writeHead(result.statusCode, {
      "Content-Type": contentType, "Cache-Control": "no-store, no-transform",
      "X-Content-Type-Options": "nosniff", "X-Accel-Buffering": "no",
    });
    response.flushHeaders();
    result.on("error", () => response.destroy());
    result.pipe(response);
  });
  upstream.on("timeout", () => upstream.destroy(new Error("Gift Search worker timed out.")));
  upstream.on("error", () => {
    if (response.destroyed) return;
    if (response.headersSent) response.destroy();
    else replyJson(response, 502, { error: "The paired Gift Search worker is unavailable." });
  });
  response.once("close", () => upstream.destroy());
  request.once("error", () => upstream.destroy());
  request.pipe(upstream);
}
