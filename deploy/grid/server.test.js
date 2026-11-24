import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { SignJWT } from "jose";
import { runGiftTeam } from "../../server/gift-team.js";
import { retailerThumbnailUrl } from "../../server/retailer-evidence.js";

async function availablePort() {
  const reservation = createServer().listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const { port } = reservation.address();
  await new Promise((done) => reservation.close(done));
  return port;
}

const accountKey = (subject) => createHash("sha256").update(subject).digest("hex");

test("Retailer photos use the listing's HTTPS preview metadata", () => {
  const html = `<head>
    <meta content="https://private.internal/example.jpg" property="og:image:secure_url">
    <meta content='/media/puzzle.webp?width=400&amp;v=2' property='og:image'>
  </head><body><meta property="og:image:secure_url" content="https://elsewhere.example/logo.png"></body>`;
  assert.equal(retailerThumbnailUrl(html, "https://shop.example.com/products/puzzle")?.href,
    "https://shop.example.com/media/puzzle.webp?width=400&v=2");
  assert.equal(retailerThumbnailUrl('<meta property="og:image" content="http://shop.example.com/puzzle.png">',
    "https://shop.example.com/products/puzzle"), null);
  const productData = `<script type="application/ld+json">{
    "@graph":[
      {"@type":"Organization","image":"https://shop.example.com/logo.png"},
      {"@type":["Product"],"image":["http://shop.example.com/puzzle.png",{"contentUrl":"https://cdn.example.com/puzzle.jpg"}]}
    ]
  }</script>`;
  assert.equal(retailerThumbnailUrl(productData, "https://shop.example.com/products/puzzle")?.href,
    "https://cdn.example.com/puzzle.jpg");
});

test("Refinement keeps the previous board and rechecks earlier picks against the edited brief", async () => {
  const brief = { budget: 35, currency: "USD" };
  const focus = "Find a compact puzzle to add to the gift.";
  const oldUrl = "https://retailer.example/old-gift";
  const newUrl = "https://retailer.example/desk-puzzle";
  const reviewer = { id: "review", name: "Reviewer", persona: "Retail specialist", focus: "Verify listings." };
  const board = [{ id: 1, turn: 1, author: "Reviewer", text: "Prior research", type: "update" }];
  const listing = (candidateId, url, name, price) => ({
    candidateId, url, name, price, category: "Puzzles", currency: "USD", merchant: "Fixture shop",
    reason: "Compact", caveat: "", inStock: true, shipsToRegion: true, shippingCost: 5,
  });
  let checkpoint;
  const result = await runGiftTeam(brief, {
    focus, recheckGifts: [listing(0, oldUrl, "Old gift", 50)],
    resume: { completedTurns: 1, board, reviewer, notes: ["Prior review notes"], verified: [[0, listing(0, oldUrl, "Old gift", 50)]] },
    async plan(currentBrief, totalTurns, context) {
      assert.equal(currentBrief.budget, 35);
      assert.equal(totalTurns, 2);
      assert.deepEqual(context.board[0], board[0]);
      assert.match(context.board.at(-1).text, /compact puzzle/);
      return { scouts: [
        { name: "Puzzle scout", persona: "Puzzle researcher", focus: "Look for a puzzle." },
        { name: "Desk scout", persona: "Small-space gift researcher", focus: "Look for compact options." },
      ] };
    },
    async scout() {
      return { candidates: [{ seedId: null, name: "Desk puzzle", merchant: "Fixture shop", url: newUrl, reason: "Compact" }] };
    },
    async review(_role, currentBrief, candidates) {
      assert.equal(currentBrief.budget, 35);
      assert.deepEqual(candidates.map(({ url }) => url), [newUrl, oldUrl]);
      return {
        gifts: candidates.map(({ candidateId, url, name }) => listing(candidateId, url, name, url === newUrl ? 27 : 50)),
        fetched: new Set([newUrl, oldUrl]),
        rejected: [{ candidateId: 0, reason: "The price exceeds the edited budget." }], notes: [],
      };
    },
    async onCheckpoint(state) { checkpoint = state; },
  });
  assert.equal(checkpoint.completedTurns, 2);
  assert.deepEqual(checkpoint.board[0], board[0]);
  assert.ok(checkpoint.board.some(({ text, turn }) => turn === 2 && text.includes(focus)));
  assert.deepEqual(result.gifts.map(({ name }) => name), ["Desk puzzle"]);
  assert.equal(result.leads[0].review, "The price exceeds the edited budget.");
});

async function gridRuntime(t, env = {}) {
  const port = await availablePort();
  const key = randomBytes(32).toString("hex");
  const issuer = "caipe-agentic-apps";
  const runtime = spawn(process.execPath, ["deploy/grid/server.js"], {
    env: { ...process.env, PORT: String(port), AGENTIC_APP_TOKEN_SECRET: key, AGENTIC_APP_TOKEN_ISSUER: issuer, ...env },
  });
  const exited = once(runtime, "exit");
  t.after(async () => {
    runtime.kill();
    await exited;
  });
  await Promise.race([
    once(runtime.stdout, "data"),
    exited.then(([code]) => assert.fail(`Grid runtime exited with status ${code}`)),
  ]);

  function token({ app = "gift-search", scopes = ["gift-search:read"], expiry = "5m", subject = "fixture-user" } = {}) {
    return new SignJWT({ app_id: app, scp: scopes })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(issuer)
      .setAudience("agentic-app:gift-search")
      .setSubject(subject)
      .setExpirationTime(expiry)
      .sign(Buffer.from(key));
  }
  function request(path, credential, method = "GET", options = {}) {
    return fetch(`http://127.0.0.1:${port}${path}`, {
      ...options, method,
      headers: { ...options.headers, ...(credential && { Authorization: `Bearer ${credential}` }) },
    });
  }
  return { request, token };
}

test("Grid serves the deep-linked demo to authorized readers", { timeout: 10_000 }, async (t) => {
  const { request, token } = await gridRuntime(t);

  assert.equal((await request("/healthz")).status, 200);
  assert.equal((await request("/?demo=chocolate")).status, 401);
  assert.equal((await request("/", await token({ app: "different-app" }))).status, 401);
  assert.equal((await request("/", await token({ expiry: 1 }))).status, 401);
  assert.equal((await request("/", await token({ scopes: [] }))).status, 403);
  const credential = await token();
  const page = await request("/?demo=chocolate", credential);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /name="gift-search-mount" content="\/apps\/gift-search"/);
  const mounted = await request("/apps/gift-search?demo=chocolate", credential);
  assert.equal(mounted.status, 200);
  const mountedHtml = await mounted.text();
  assert.match(mountedHtml, /src="\/apps\/gift-search\/dashboard\.js"/);
  assert.match(mountedHtml, /src="\/apps\/gift-search\/theme\.js"/);
  const theme = await request("/apps/gift-search/theme.js", credential);
  assert.equal(theme.status, 200);
  assert.match(theme.headers.get("content-type"), /javascript/);
  for (const path of ["index.html", "dashboard.html"]) {
    const dashboard = await request(`/apps/gift-search/${path}?demo=chocolate`, credential);
    assert.equal(dashboard.status, 200);
    const html = await dashboard.text();
    assert.match(html, /How the agents work/);
    assert.match(html, /<a href="https:\/\/sriaradhyula\.github\.io\/gift-search-agent-skill\/">Skill guide<\/a>/);
  }
  const architecture = await request("/apps/gift-search/architecture.html", credential);
  assert.equal(architecture.status, 200);
  assert.match(await architecture.text(), /Shared research memory/);
  assert.equal((await request("/apps/gift-search/site.css", credential)).status, 200);
  assert.equal((await request("/apps/gift-search/dashboard.js", credential)).status, 200);
  assert.match(await (await request("/demos.js", credential)).text(), /id: "chocolate"/);
  assert.equal((await request("/styles.css", credential, "HEAD")).status, 200);
  assert.equal((await request("/api/search", credential, "POST")).status, 405);
  assert.equal((await request("/api/runs", credential)).status, 404);
});

test("Grid streams a live run through the relay only for the paired account", { timeout: 10_000 }, async (t) => {
  const origin = "https://grid.example.test";
  const workerToken = randomBytes(32).toString("hex");
  const workspace = await mkdtemp(join(tmpdir(), "gift-grid-test-"));
  t.after(() => rm(workspace, { recursive: true }));
  const tokenFile = join(workspace, "relay-token");
  await writeFile(tokenFile, workerToken, { mode: 0o600 });
  const thumbnailPath = "/api/runs/00000000-0000-4000-8000-000000000001/gifts/0/thumbnail/26ab56cd";
  let received = 0;
  const worker = createHttpServer(async (request, response) => {
    assert.equal(request.headers.authorization, undefined);
    assert.equal(request.headers["x-gift-grid-account"], accountKey("fixture-user"));
    if (request.url === "/api/config") {
      response.writeHead(200, { "Content-Type": "application/json" });
      return response.end('{"live":true}');
    }
    if (request.url === thumbnailPath) {
      response.writeHead(200, { "Content-Type": "image/webp" });
      return response.end("fixture-image");
    }
    if (request.url === "/api/session/wipe") {
      received++;
      response.writeHead(200, { "Content-Type": "application/json" });
      return response.end('{"wiped":true}');
    }
    received++;
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    assert.equal(Buffer.concat(chunks).toString(), '{"budget":55}');
    response.writeHead(200, { "Content-Type": "application/x-ndjson" });
    response.write('{"kind":"run-started"}\n');
    setTimeout(() => response.end('{"kind":"report"}\n'), 25);
  }).listen(0, "127.0.0.1");
  await once(worker, "listening");
  t.after(() => worker.closeAllConnections());
  t.after(() => new Promise((done) => worker.close(done)));
  const relayPort = await availablePort();
  const relayOrigin = `http://127.0.0.1:${relayPort}`;
  const relay = spawn(process.execPath, ["deploy/grid/worker-relay.js"], {
    env: { ...process.env, PORT: String(worker.address().port), GIFT_GRID_RELAY_PORT: String(relayPort),
      GIFT_GRID_RELAY_TOKEN_FILE: tokenFile },
  });
  const relayExit = once(relay, "exit");
  t.after(async () => {
    relay.kill();
    await relayExit;
  });
  const { request, token } = await gridRuntime(t, {
    GIFT_GRID_LIVE_SUBJECT: "fixture-user", GIFT_GRID_LIVE_TOKEN: workerToken,
    GIFT_GRID_LIVE_WORKER: relayOrigin, GIFT_GRID_BROWSER_ORIGIN: origin,
  });
  for (let attempts = 0; attempts < 30; attempts++) {
    try {
      const result = await fetch(`${relayOrigin}/api/runs`);
      assert.equal(result.status, 401);
      break;
    } catch (error) {
      if (attempts === 29 || error.cause?.code !== "ECONNREFUSED") throw error;
      await new Promise((done) => setTimeout(done, 20));
    }
  }
  const ownerRead = await token();
  const ownerRun = await token({ scopes: ["gift-search:live"] });
  const other = await token({ subject: "other-user" });
  const otherRun = await token({ scopes: ["gift-search:live"], subject: "other-user" });
  const post = { headers: { origin, "content-type": "application/json", accept: "application/x-ndjson" }, body: '{"budget":55}' };

  assert.deepEqual(await (await request("/api/config", other)).json(), { live: false });
  assert.equal((await request("/api/runs", other)).status, 403);
  assert.equal((await request(thumbnailPath, other)).status, 403);
  const thumbnail = await request(`/apps/gift-search${thumbnailPath}`, ownerRead);
  assert.equal(thumbnail.status, 200);
  assert.equal(thumbnail.headers.get("content-type"), "image/webp");
  assert.equal(thumbnail.headers.get("cache-control"), "no-store, no-transform");
  assert.equal(await thumbnail.text(), "fixture-image");
  assert.deepEqual(await (await request("/apps/gift-search/api/config", ownerRead)).json(), { live: true });
  assert.equal((await request("/api/search", otherRun, "POST", post)).status, 403);
  assert.equal((await request("/api/search", ownerRead, "POST", post)).status, 403);
  assert.equal((await request("/api/search", ownerRun, "POST", { ...post, headers: { origin: "https://another.example" } })).status, 403);
  assert.equal((await request("/api/search", ownerRun, "POST", { ...post, headers: { origin, "sec-fetch-site": "cross-site" } })).status, 403);
  assert.equal((await request("/api/unknown", ownerRun, "POST", post)).status, 405);
  const result = await request("/api/search", ownerRun, "POST", post);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("content-type"), "application/x-ndjson");
  assert.equal(await result.text(), '{"kind":"run-started"}\n{"kind":"report"}\n');
  assert.equal(received, 1);

  const wipePath = "/apps/gift-search/api/session/wipe";
  const wipe = { headers: { origin, "content-type": "application/json" }, body: "{}" };
  assert.equal((await request(wipePath, otherRun, "POST", wipe)).status, 403);
  assert.equal((await request(wipePath, ownerRead, "POST", wipe)).status, 403);
  assert.equal((await request(wipePath, ownerRun, "POST", { ...wipe, headers: {} })).status, 403);
  assert.equal((await fetch(`${relayOrigin}/api/session/wipe`, { method: "POST" })).status, 401);
  assert.equal(received, 1);
  const wiped = await request(wipePath, ownerRun, "POST", { ...wipe, headers: { ...wipe.headers, "x-gift-grid-account": "forged" } });
  assert.equal(wiped.status, 200);
  assert.deepEqual(await wiped.json(), { wiped: true });
  assert.equal(received, 2);
});

test("Managed worker clears only its saved runs and scratch files while idle", { timeout: 10_000 }, async (t) => {
  const workspace = await mkdtemp(join(tmpdir(), "gift-wipe-test-"));
  const sessions = join(workspace, "sessions");
  const history = join(workspace, "history");
  const subject = "fixture-user";
  const accountSessions = join(sessions, accountKey(subject));
  const accountHistory = join(history, "grid", accountKey(subject));
  const release = join(workspace, "finish-chat");
  const harness = join(workspace, "fake-claude.cjs");
  const runId = "00000000-0000-4000-8000-000000000001";
  await mkdir(history);
  await mkdir(join(accountSessions, "gift-search-acp-Legacy"), { recursive: true });
  await writeFile(join(history, `${runId}.json`), JSON.stringify({
    version: 1, id: runId, brief: { recipient: "Test" }, report: { gifts: [] },
    events: [], committedEvents: 0, updatedAt: "2026-11-23",
  }));
  await writeFile(join(history, `.${runId}.${runId}.tmp`), "partial checkpoint");
  await writeFile(join(history, "unrelated.txt"), "keep");
  await writeFile(join(accountSessions, "unrelated.txt"), "keep");
  await writeFile(harness, `#!/usr/bin/env node
const { existsSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { createInterface } = require("node:readline");
const send = (message) => console.log(JSON.stringify(message));
createInterface({ input: process.stdin }).on("line", (line) => {
  const { id, method } = JSON.parse(line);
  if (method === "initialize") send({ id, result: { protocolVersion: 1 } });
  if (method === "session/new") {
    writeFileSync(join(process.env.HOME, "synthetic-transcript"), "chat");
    send({ id, result: { sessionId: "fixture" } });
  }
  if (method === "session/prompt") {
    const wait = setInterval(() => {
      if (!existsSync(process.env.FIXTURE_RELEASE)) return;
      clearInterval(wait);
      send({ id, result: { stopReason: "end_turn" } });
    }, 20);
  }
});
`, { mode: 0o700 });
  const workers = [];
  t.after(async () => {
    await writeFile(release, "").catch(() => {});
    for (const { worker, exit } of workers) {
      worker.kill();
      await exit;
    }
    await rm(workspace, { recursive: true, force: true });
  });
  async function startWorker(subject) {
    const port = await availablePort();
    const worker = spawn(process.execPath, ["server/index.js", "--claude-acp"], {
      env: { ...process.env, HOME: workspace, PORT: String(port), GIFT_SESSION_DIR: sessions, GIFT_HISTORY_DIR: history,
        GIFT_GRID_LIVE_SUBJECT: subject, CLAUDE_ACP_EXECUTABLE: harness, FIXTURE_RELEASE: release,
        SERPAPI_API_KEY: "", SERPAPI_API_KEY_FILE: "",
        GIFT_CLAUDE_LITELLM_BASE_URL: "", GIFT_CLAUDE_LITELLM_TOKEN: "", GIFT_CLAUDE_LITELLM_MODEL: "" },
    });
    const exit = once(worker, "exit");
    workers.push({ worker, exit });
    await Promise.race([once(worker.stdout, "data"), exit.then(([code]) => assert.fail(`Worker exited with status ${code}`))]);
    return (path, options = {}) => fetch(`http://127.0.0.1:${port}/api/${path}`, {
      ...options, headers: { "x-gift-grid-account": accountKey(subject), ...options.headers },
    });
  }

  const post = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const request = await startWorker(subject);
  assert.equal((await (await request("config")).json()).sessionWipe, true);
  assert.equal((await request(`runs/${runId}`)).status, 200);
  assert.equal((await request("runs", { headers: { "x-gift-grid-account": accountKey("other-user") } })).status, 403);
  assert.deepEqual(await readdir(accountHistory), [`${runId}.json`]);
  await writeFile(join(accountHistory, `.${runId}.${runId}.tmp`), "partial checkpoint");
  const other = await startWorker("other-user");
  assert.deepEqual(await (await other("runs")).json(), []);
  assert.equal((await other(`runs/${runId}`)).status, 404);
  assert.deepEqual(await (await other("session/wipe", post({}))).json(), { wiped: true });
  assert.equal((await request(`runs/${runId}`)).status, 200);
  const local = await startWorker("");
  assert.equal((await (await local("config")).json()).sessionWipe, undefined);
  assert.equal((await local("session/wipe", post({}))).status, 404);

  const chat = await request("chat", post({ messages: [{ role: "user", content: "Test chat" }] }));
  assert.equal(chat.status, 200);
  assert.equal((await request("session/wipe", post({}))).status, 409);
  await writeFile(release, "");
  assert.match(await chat.text(), /"kind":"done"/);
  assert.deepEqual((await readdir(accountSessions)).sort(), ["gift-search-acp-Legacy", "unrelated.txt"]);
  assert.deepEqual(await (await request("session/wipe", post({}))).json(), { wiped: true });
  assert.deepEqual(await (await request("runs")).json(), []);
  assert.equal((await request(`runs/${runId}`)).status, 404);
  assert.equal((await request("search", post({ runId }))).status, 404);
  assert.deepEqual(await readdir(accountHistory), []);
  assert.deepEqual((await readdir(history)).sort(), [".grid-history-owner", "grid", "unrelated.txt"]);
  assert.deepEqual(await readdir(accountSessions), ["unrelated.txt"]);
  assert.deepEqual(await (await request("session/wipe", post({}))).json(), { wiped: true });
});
