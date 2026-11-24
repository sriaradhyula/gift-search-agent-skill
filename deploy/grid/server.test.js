import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { SignJWT } from "jose";

async function availablePort() {
  const reservation = createServer().listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const { port } = reservation.address();
  await new Promise((done) => reservation.close(done));
  return port;
}

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
    assert.match(await dashboard.text(), /Watch agents find/);
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
  let received = 0;
  const worker = createHttpServer(async (request, response) => {
    assert.equal(request.headers.authorization, undefined);
    if (request.url === "/api/config") {
      response.writeHead(200, { "Content-Type": "application/json" });
      return response.end('{"live":true}');
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
});
