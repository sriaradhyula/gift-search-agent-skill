import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { forwardLiveRequest, isLiveRoute, replyJson } from "./live-proxy.js";

const token = readFileSync(process.env.GIFT_GRID_RELAY_TOKEN_FILE, "utf8").trim();
if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Invalid Gift Search relay token.");
const expected = Buffer.from(`Bearer ${token}`);
const target = new URL(`http://127.0.0.1:${Number(process.env.PORT || 8000)}`);
const relayPort = Number(process.env.GIFT_GRID_RELAY_PORT || 18001);

const server = createServer((request, response) => {
  const provided = Buffer.from(request.headers.authorization ?? "");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return replyJson(response, 401, { error: "Worker authorization required." });
  }
  const path = request.url.split("?")[0];
  if (!isLiveRoute(request.method, path)) return replyJson(response, 404, { error: "Unknown worker route." });
  forwardLiveRequest(request, response, target, { path, gridAccount: request.headers["x-gift-grid-account"] });
});

server.listen(relayPort, "0.0.0.0");
