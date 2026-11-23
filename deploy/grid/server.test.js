import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import { test } from "node:test";
import { SignJWT } from "jose";

test("Grid serves the deep-linked demo to authorized readers", { timeout: 10_000 }, async (t) => {
  const reservation = createServer().listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const { port } = reservation.address();
  await new Promise((done) => reservation.close(done));

  const key = randomBytes(32).toString("hex");
  const issuer = "caipe-agentic-apps";
  const runtime = spawn(process.execPath, ["deploy/grid/server.js"], {
    env: { ...process.env, PORT: String(port), AGENTIC_APP_TOKEN_SECRET: key, AGENTIC_APP_TOKEN_ISSUER: issuer },
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

  function token({ app = "gift-search", scopes = ["gift-search:read"], expiry = "5m" } = {}) {
    return new SignJWT({ app_id: app, scp: scopes })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(issuer)
      .setAudience("agentic-app:gift-search")
      .setSubject("fixture-user")
      .setExpirationTime(expiry)
      .sign(Buffer.from(key));
  }
  function request(path, credential, method = "GET") {
    return fetch(`http://127.0.0.1:${port}${path}`, {
      method, ...(credential && { headers: { Authorization: `Bearer ${credential}` } }),
    });
  }

  assert.equal((await request("/healthz")).status, 200);
  assert.equal((await request("/?demo=chocolate")).status, 401);
  assert.equal((await request("/", await token({ app: "different-app" }))).status, 401);
  assert.equal((await request("/", await token({ expiry: 1 }))).status, 401);
  assert.equal((await request("/", await token({ scopes: [] }))).status, 403);
  const credential = await token();
  const page = await request("/?demo=chocolate", credential);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /name="gift-search-mount" content="\/apps\/gift-search"/);
  assert.match(await (await request("/demos.js", credential)).text(), /id: "chocolate"/);
  assert.equal((await request("/styles.css", credential, "HEAD")).status, 200);
  assert.equal((await request("/api/search", credential, "POST")).status, 405);
  assert.equal((await request("/api/runs", credential)).status, 404);
});
