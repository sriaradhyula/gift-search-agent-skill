import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { validBrief } from "../skills/gift-search/scripts/report.mjs";
import { readSerpApiKey } from "../skills/gift-search/scripts/shopping.mjs";
import { chatWithHarness, searchWithHarness } from "./claude-acp.js";
import { readDashboardAsset } from "./dashboard-assets.js";
import { MAX_RESEARCH_TURNS } from "./gift-team.js";
import { availableHarnesses, harnessCommand, harnesses } from "./harnesses.js";
import { listRuns, loadRun, newRun, runSummary, saveRun } from "./run-history.js";
import { liveReport, searchGifts } from "./search.js";

const port = Number(process.env.PORT || 8000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}
const demoOnly = process.argv.includes("--demo");
const apiKey = demoOnly ? undefined : process.env.OPENAI_API_KEY?.trim();
const useHarnesses = !demoOnly && process.argv.includes("--claude-acp");
const liveEnabled = useHarnesses || Boolean(apiKey);
const serpApiKey = liveEnabled ? await readSerpApiKey().catch((error) => {
  console.warn(error.message);
  return null;
}) : null;
const model = process.env.OPENAI_GIFT_MODEL || "gpt-5-mini";
const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
let searching = false;
let activeRunId = null;

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

async function readJson(request, limit) {
  let length = 0;
  const chunks = [];
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    length += chunk.length;
    if (length > limit) throw new Error("Request is too long.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function parseBrief(body) {
  if (!validBrief(body) || !body.recipient.trim() || !body.region.trim()
      || body.budget === null || body.budget <= 0 || body.budget > 1_000_000) {
    throw new Error("Invalid gift brief.");
  }
  const { recipient, occasion, interests, budget, currency, region, neededBy, exclude } = body;
  return { recipient, occasion, interests, budget, currency, region, neededBy, exclude };
}

function localOrigin(request) {
  return (!request.headers.origin || request.headers.origin === `http://${request.headers.host}`)
    && request.headers["sec-fetch-site"] !== "cross-site";
}

function localJson(request) {
  return localOrigin(request) && request.headers["content-type"]?.split(";")[0] === "application/json";
}

function startStream(response) {
  response.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform",
  });
  response.flushHeaders();
  return (event) => {
    if (!response.destroyed) response.write(JSON.stringify(event) + "\n");
  };
}

function logActivity(event) {
  if (process.env.GIFT_CLAUDE_CONSOLE !== "1") return;
  if (event.kind === "planning-start") console.log(`[Team planner] Creating personas for turn ${event.turn}`);
  if (event.kind === "team-plan") console.log(`[Team planner] Turn ${event.turn} · ${[...event.scouts, event.reviewer].map(({ name }) => name).join(", ")}`);
  if (event.kind === "turn-start") console.log(`[Coordinator] Turn ${event.turn} of ${event.researchTurns}`);
  if (event.kind === "scout-start") console.log(`[${event.role}] Started`);
  if (event.kind === "claude-session") console.log(`[${event.role}] ACP session ready`);
  if (event.kind === "claude-tool") console.log(`[${event.role}] ${event.tool} · ${event.status}`);
  if (event.kind === "scout-handoff") console.log(`[${event.role}] Sent ${event.candidates.length} leads`);
  if (event.kind === "scout-failure") console.log(`[${event.role}] Unavailable`);
  if (event.kind === "review-start") console.log(`[${event.role}] Received ${event.candidates.length} distinct leads`);
  if (event.kind === "review-complete") console.log(`[${event.role}] Review complete`);
}

async function handleSearch(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { error: "Use POST to search." });
  if (!localJson(request)) {
    return sendJson(response, 403, { error: "Open the local dashboard to search." });
  }
  if (!liveEnabled) return sendJson(response, 503, { error: "Start with npm start for Claude Code, or set OPENAI_API_KEY and run npm run start:openai." });
  if (searching) return sendJson(response, 409, { error: "Wait for the current research run to finish." });
  const stream = useHarnesses && request.headers.accept === "application/x-ndjson";
  let sendEvent;
  let record;
  let pendingEvents = [];
  searching = true;
  try {
    let body;
    try {
      body = await readJson(request, 8192);
      if (!body || typeof body !== "object") throw new Error("Invalid input");
    } catch {
      if (!response.destroyed) sendJson(response, 400, { error: "Enter a valid brief with a recipient, region, and budget." });
      return;
    }
    const { researchTurns = 1, runId } = body;
    let brief;
    let prior;
    if (useHarnesses && runId !== undefined) {
      prior = await loadRun(runId);
      if (!prior) return sendJson(response, 404, { error: "The saved run was not found." });
      brief = prior.brief;
    } else {
      try {
        brief = parseBrief(body);
      } catch {
        return sendJson(response, 400, { error: "Enter a valid brief with a recipient, region, and budget." });
      }
    }
    const harness = prior?.harness ?? body.harness ?? "claude";
    if (useHarnesses) {
      if (!Number.isInteger(researchTurns) || researchTurns < 1 || researchTurns > MAX_RESEARCH_TURNS) {
        return sendJson(response, 400, { error: `Choose between 1 and ${MAX_RESEARCH_TURNS} research turns.` });
      }
      if (typeof harness !== "string" || !Object.hasOwn(harnesses, harness)) {
        return sendJson(response, 400, { error: "Choose a supported research harness." });
      }
      if (!harnessCommand(harness)) {
        return sendJson(response, 503, { error: `${harnesses[harness].label} is unavailable on this computer.` });
      }
    }
    const controller = new AbortController();
    response.once("close", () => controller.abort());
    const signal = controller.signal;
    if (response.destroyed) return;
    if (useHarnesses) {
      record = prior ?? newRun(brief, harness, liveReport(brief, [], []));
      record.status = "running";
      // Keep the completed turns and replace any partial attempt at the next turn.
      record.events = record.events.slice(0, record.committedEvents);
      activeRunId = record.id;
      await saveRun(record);
    }
    if (stream) sendEvent = startStream(response);
    if (record) sendEvent?.({ kind: "run-started", id: record.id, harness, completedTurns: record.completedTurns });
    const onEvent = (event) => {
      logActivity(event);
      if (record) pendingEvents.push(structuredClone(event));
      sendEvent?.(event);
    };
    const report = record
      ? await searchWithHarness(brief, {
        harness, serpApiKey, signal, researchTurns, onEvent, resume: record.checkpoint,
        checkedOn: record.report.gifts.length ? record.report.checkedOn : undefined,
        async onCheckpoint(checkpoint, report) {
          record.checkpoint = checkpoint;
          record.completedTurns = checkpoint.completedTurns;
          record.report = report;
          record.events.push(...pendingEvents);
          record.committedEvents = record.events.length;
          pendingEvents = [];
          await saveRun(record);
        },
      })
      : await searchGifts(brief, { apiKey, serpApiKey, model, signal });
    if (record) {
      record.report = report;
      record.status = "complete";
      record.events.push(...pendingEvents);
      pendingEvents = [];
      await saveRun(record);
    }
    if (stream) {
      sendEvent({ kind: "report", report, ...(record && { id: record.id }) });
      response.end();
    } else sendJson(response, 200, report);
  } catch (error) {
    if (record) {
      record.status = response.destroyed ? "stopped" : "failed";
      record.events.push(...pendingEvents);
      await saveRun(record).catch(() => console.warn("Could not save the latest research history."));
    }
    if (!response.destroyed) {
      if (useHarnesses) {
        if (stream && response.headersSent) {
          sendEvent({ kind: "error", error: error.message });
          response.end();
        } else sendJson(response, 502, { error: error.message });
        return;
      }
      const diagnostic = /^(Search provider (returned HTTP \d+\.|did not finish the response\.|returned no usable research\.))$/.test(error.message)
        ? ` ${error.message}` : "";
      sendJson(response, 502, { error: `Live search could not finish.${diagnostic} Check the API key and model, then try again.` });
    }
  } finally {
    searching = false;
    activeRunId = null;
  }
}

async function handleChat(request, response) {
  if (!useHarnesses) return sendJson(response, 503, { error: "Start the local harness dashboard with npm start." });
  if (request.method !== "POST") return sendJson(response, 405, { error: "Use POST to chat." });
  if (!localJson(request)) return sendJson(response, 403, { error: "Open the local page to chat." });
  let body;
  try {
    body = await readJson(request, 2 * 1024 * 1024);
    if (!Array.isArray(body?.messages) || body.messages.length > 12 || body.messages.at(-1)?.role !== "user"
        || body.messages.some((message) => !["user", "assistant"].includes(message?.role)
          || typeof message.content !== "string" || !message.content.trim())) {
      throw new Error("Invalid chat messages.");
    }
  } catch (error) {
    const tooLong = error.message === "Request is too long.";
    if (!response.destroyed) sendJson(response, tooLong ? 413 : 400, { error: tooLong ? "This chat request is too large." : "Send a chat message." });
    return;
  }
  const harness = body.harness ?? "claude";
  if (typeof harness !== "string" || !Object.hasOwn(harnesses, harness) || !harnessCommand(harness)) {
    return sendJson(response, 400, { error: "Select an available chat harness." });
  }
  const controller = new AbortController();
  response.once("close", () => controller.abort());
  const send = startStream(response);
  try {
    const messages = body.messages.map(({ role, content }) => ({ role, content }));
    await chatWithHarness({ messages, context: body.context }, {
      harness,
      signal: controller.signal,
      onEvent(event) {
        logActivity(event);
        send(event);
      },
    });
    send({ kind: "done" });
  } catch (error) {
    send({ kind: "error", error: error.message });
  }
  response.end();
}

async function handleHistory(request, response, id) {
  if (!useHarnesses) return sendJson(response, 404, { error: "Search history is unavailable." });
  if (request.method !== "GET") return sendJson(response, 405, { error: "Use GET to read search history." });
  if (!localOrigin(request)) return sendJson(response, 403, { error: "Open the local dashboard to read history." });
  try {
    if (!id) return sendJson(response, 200, await listRuns(activeRunId));
    const record = await loadRun(id);
    if (!record) return sendJson(response, 404, { error: "The saved run was not found." });
    return sendJson(response, 200, {
      ...runSummary(record, activeRunId), report: record.report, events: record.events, committedEvents: record.committedEvents,
    });
  } catch {
    return sendJson(response, 500, { error: "Could not read saved search history." });
  }
}

const server = createServer(async (request, response) => {
  if (!hosts.has(request.headers.host)) return sendJson(response, 403, { error: "Use the loopback dashboard address." });

  const path = request.url.split("?")[0];
  if (path === "/api/search") return handleSearch(request, response);
  if (path === "/api/chat" || path === "/api/claude/chat") return handleChat(request, response);
  if (path === "/api/runs" || path.startsWith("/api/runs/")) return handleHistory(request, response, path.slice("/api/runs/".length));
  if (path === "/api/config" && request.method === "GET") {
    return sendJson(response, 200, {
      live: liveEnabled, shopping: liveEnabled && Boolean(serpApiKey), claude: useHarnesses, maxResearchTurns: MAX_RESEARCH_TURNS,
      ...(useHarnesses && { harnesses: availableHarnesses(), defaultHarness: "claude", history: true }),
    });
  }

  if (!["GET", "HEAD"].includes(request.method)) return sendJson(response, 404, { error: "Page not found." });

  try {
    const asset = await readDashboardAsset(path);
    if (!asset) return sendJson(response, 404, { error: "Page not found." });
    const { type, content } = asset;
    response.writeHead(200, { "Content-Type": type, "Content-Length": content.length });
    response.end(request.method === "HEAD" ? null : content);
  } catch {
    sendJson(response, 500, { error: "Unable to read the requested file." });
  }
});

server.on("error", (error) => {
  console.error(error.code === "EADDRINUSE"
    ? `Port ${port} is already in use. Choose another with ./runme.sh --port <port>.`
    : error.message);
  process.exitCode = 1;
});

server.listen(port, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${port}`;
  console.log(`Gift Search is running at ${url}`);
  if (!process.argv.includes("--open")) return;
  const browser = process.platform === "darwin" ? "open"
    : process.platform === "linux" && process.env.WSL_DISTRO_NAME ? "wslview"
    : process.platform === "linux" && (process.env.DISPLAY || process.env.WAYLAND_DISPLAY) ? "xdg-open" : null;
  if (!browser) return;
  const open = spawn(browser, [url], { stdio: "ignore", detached: true });
  const manual = () => console.log(`Open ${url} in your browser.`);
  open.once("error", manual);
  open.once("exit", (code) => { if (code) manual(); });
  open.unref();
});
