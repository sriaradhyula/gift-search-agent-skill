import { productUrl } from "./report.js";

const teamPanel = document.getElementById("team-panel");
const teamMode = document.getElementById("team-mode");
const teamDetails = document.getElementById("team-details");
const teamToggle = document.getElementById("team-toggle");
const turnLabel = document.getElementById("team-turn");
const scoutNodes = document.getElementById("team-scouts");
const branchOut = document.getElementById("team-branches-out");
const branchIn = document.getElementById("team-branches-in");
const boardPanel = document.getElementById("research-board");
const memoryStatus = document.getElementById("memory-status");
const memoryAll = document.getElementById("memory-all");
const memoryFeed = document.getElementById("memory-feed");
const memoryEmpty = document.getElementById("memory-empty");
const memoryDownload = document.getElementById("download-memory");
const teamLog = document.getElementById("team-log");
const consoleLog = document.getElementById("claude-console");
const consoleTitle = document.getElementById("team-console-title");
const consoleLines = document.getElementById("claude-console-lines");
const diagramNamespace = "http://www.w3.org/2000/svg";
const scoutCharacters = ["🦌", "🧝", "🧝🏽‍♂️"];
const memoryLabels = {
  highlight: "Highlight", lead: "Lead", verified: "Verified", decision: "Review", update: "Update",
  error: "Issue", assignment: "Assignment", plan: "Planning", turn: "Progress",
};
const highlightTypes = new Set(["highlight", "lead", "verified", "decision", "update", "error"]);
const memory = [];
const teamHistory = [];

function teamNode(name) {
  return document.querySelector(`[data-node="${name}"]`);
}

function nodeState(name, status, text) {
  const node = teamNode(name);
  if (!node) return;
  node.dataset.status = status;
  node.querySelector(".team-node-status").textContent = text;
}

function wireState(name, status) {
  const wire = document.querySelector(`[data-wire="${name}"]`);
  if (wire) wire.dataset.status = status;
}

function newWire(id, path) {
  const wire = document.createElementNS(diagramNamespace, "path");
  wire.dataset.wire = id;
  wire.setAttribute("d", path);
  return wire;
}

function assignRole(node, role) {
  node.querySelector("strong").textContent = role.name;
  node.querySelector("small").textContent = role.persona;
  node.title = role.focus;
}

function showTeamPlan(scouts, reviewer, turn) {
  teamHistory.push({ turn, scouts, reviewer });
  scoutNodes.style.setProperty("--scout-count", scouts.length);
  scoutNodes.replaceChildren(...scouts.map((role, index) => {
    const node = document.createElement("div");
    const character = document.createElement("span");
    const status = document.createElement("span");
    node.className = "team-node";
    node.dataset.node = role.id;
    character.className = "team-character";
    character.setAttribute("aria-hidden", "true");
    character.textContent = scoutCharacters[index];
    status.className = "team-node-status";
    status.textContent = "Ready";
    node.append(character, document.createElement("strong"), document.createElement("small"), status);
    assignRole(node, role);
    return node;
  }));
  branchOut.replaceChildren(...scouts.map(({ id }, index) => {
    const x = 600 * (index + 0.5) / scouts.length;
    return newWire(`${id}-in`, `M300 0 V12 H${x} V34`);
  }));
  branchIn.replaceChildren(...scouts.map(({ id }, index) => {
    const x = 600 * (index + 0.5) / scouts.length;
    return newWire(`${id}-out`, `M${x} 0 V22 H300 V34`);
  }));
  const review = teamNode("review");
  assignRole(review, reviewer);
  for (const element of [branchOut, scoutNodes, branchIn, review]) element.removeAttribute("hidden");
}

function updateMemoryView() {
  teamLog.dataset.view = memoryAll.checked ? "all" : "highlights";
  memoryEmpty.hidden = memory.some(({ type }) => memoryAll.checked || highlightTypes.has(type));
  memoryDownload.disabled = !memory.length;
}

function setMemoryStatus(status, text) {
  boardPanel.dataset.state = status;
  memoryStatus.textContent = text;
}

memoryAll.addEventListener("change", () => {
  updateMemoryView();
  memoryFeed.scrollTop = memoryFeed.scrollHeight;
});

function addBoardPost(message) {
  memory.push(message);
  const stayAtBottom = memoryFeed.scrollHeight - memoryFeed.scrollTop - memoryFeed.clientHeight < 32;
  const row = document.createElement("li");
  row.dataset.post = message.type;
  row.dataset.highlight = String(highlightTypes.has(message.type));
  row.dataset.reviewer = String(message.roleId === "review");
  const meta = document.createElement("div");
  meta.className = "memory-meta";
  const turn = document.createElement("span");
  turn.textContent = message.turn ? `Turn ${message.turn}` : "Setup";
  const tag = document.createElement("span");
  tag.className = "memory-tag";
  tag.textContent = memoryLabels[message.type] ?? "Note";
  meta.append(turn, tag);
  const label = document.createElement("strong");
  label.textContent = message.author;
  const body = document.createElement("p");
  body.textContent = message.text;
  row.append(meta, label, body);
  const source = productUrl(message.url);
  if (source) {
    const link = document.createElement("a");
    link.href = source.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Retailer page ↗";
    row.append(link);
  }
  boardPanel.hidden = false;
  teamLog.append(row);
  updateMemoryView();
  if (stayAtBottom) memoryFeed.scrollTop = memoryFeed.scrollHeight;
}

function addConsole(text) {
  consoleLog.hidden = false;
  consoleLines.textContent += text + "\n";
  consoleLines.scrollTop = consoleLines.scrollHeight;
}

function clearWires() {
  for (const path of document.querySelectorAll("[data-wire]")) delete path.dataset.status;
}

function setTeamDetails(expanded) {
  teamToggle.setAttribute("aria-expanded", String(expanded));
  teamToggle.textContent = expanded ? "Hide details" : "Show details";
  if (!expanded && teamDetails.contains(document.activeElement)) teamToggle.focus({ preventScroll: true });
  teamDetails.hidden = !expanded;
}

teamToggle.addEventListener("click", () => setTeamDetails(teamDetails.hidden));

export function resetTeam(mode, { expand = false, demo = false, consoleLabel = "Claude console" } = {}) {
  teamPanel.hidden = !expand;
  teamMode.textContent = mode;
  turnLabel.hidden = true;
  teamHistory.length = 0;
  memory.length = 0;
  teamLog.replaceChildren();
  boardPanel.hidden = !expand;
  memoryAll.checked = false;
  updateMemoryView();
  setMemoryStatus("active", "Recording");
  memoryFeed.scrollTop = 0;
  consoleLines.textContent = "";
  consoleTitle.textContent = demo ? "Run activity" : consoleLabel;
  consoleLog.hidden = true;
  scoutNodes.replaceChildren();
  for (const element of [branchOut, scoutNodes, branchIn, teamNode("review")]) element.setAttribute("hidden", "");
  nodeState("planner", "idle", "Waiting for brief");
  nodeState("review", "idle", "Waiting for scouts");
  nodeState("shortlist", "idle", "Waiting for review");
  clearWires();
  setTeamDetails(expand);
}

export function showTeamEvent(event) {
  const { kind, role, roleId, turn, researchTurns, candidates } = event;
  const scouts = teamHistory.at(-1)?.scouts ?? [];
  switch (kind) {
    case "planning-start":
      clearWires();
      nodeState("planner", "running", turn > 1 ? "Creating new personas" : "Creating personas");
      turnLabel.textContent = `Turn ${turn ?? 1} of ${researchTurns} · Assigning scouts`;
      turnLabel.hidden = false;
      addConsole(`[Team planner] Assigning scouts for turn ${turn ?? 1}`);
      break;
    case "team-plan":
      nodeState("planner", "done", event.planned ? "Personas assigned" : "Preset scouts assigned");
      showTeamPlan(event.scouts, event.reviewer, turn ?? 1);
      addConsole(`[Team planner] Turn ${turn ?? 1} scouts · ${event.scouts.map(({ name }) => name).join(", ")}`);
      break;
    case "turn-start":
      clearWires();
      turnLabel.textContent = `Turn ${turn} of ${researchTurns} · Research in progress`;
      for (const scout of scouts) nodeState(scout.id, "idle", "Reading shared board");
      nodeState("review", "idle", "Waiting for handoffs");
      addConsole(`[Coordinator] Turn ${turn} of ${researchTurns}`);
      break;
    case "scout-start":
      nodeState(roleId, "running", "Finding candidates");
      wireState(`${roleId}-in`, "running");
      addConsole(`[${role}] Started turn ${turn}`);
      break;
    case "scout-handoff":
      nodeState(roleId, "done", `${candidates.length} ${candidates.length === 1 ? "lead" : "leads"} posted`);
      wireState(`${roleId}-in`, "done");
      if (candidates.length) wireState(`${roleId}-out`, "running");
      addConsole(`[${role}] Posted ${candidates.length} leads`);
      break;
    case "scout-failure":
      nodeState(roleId, "error", "Unavailable");
      wireState(`${roleId}-in`, "idle");
      addConsole(`[${role}] Unavailable`);
      break;
    case "review-start":
      nodeState("review", "running", `Checking ${candidates.length} ${candidates.length === 1 ? "lead" : "leads"}`);
      for (const scout of scouts) wireState(`${scout.id}-out`, "idle");
      for (const candidate of candidates) {
        for (const scout of candidate.scouts) wireState(`${scout.roleId}-out`, "done");
      }
      addConsole(`[${role}] Received ${candidates.length} distinct leads`);
      break;
    case "review-complete":
      nodeState("review", "done", "Review complete");
      wireState("shortlist", "running");
      addConsole(`[${role}] Review complete`);
      break;
    case "review-skipped":
      nodeState("review", event.status === "Unavailable" ? "error" : "done", event.status);
      for (const scout of scouts) wireState(`${scout.id}-out`, "idle");
      addConsole(`[${role}] ${event.status}`);
      break;
    case "turn-complete":
      turnLabel.textContent = `Turn ${turn} of ${researchTurns} complete`;
      wireState("shortlist", "done");
      break;
    case "board-post":
      addBoardPost(event.message);
      break;
    case "claude-session":
      addConsole(`[${role}] ACP session ready`);
      break;
    case "claude-tool":
      addConsole(`[${role}] ${event.tool} · ${event.status}${event.detail ? ` · ${event.detail}` : ""}`);
      break;
  }
}

export function finishTeam(count) {
  nodeState("shortlist", "done", `${count} ${count === 1 ? "gift" : "gifts"}`);
  wireState("shortlist", "done");
  teamMode.textContent += " · Complete";
  setMemoryStatus("complete", "Complete");
  setTeamDetails(false);
}

export function stopTeam() {
  turnLabel.hidden = false;
  turnLabel.textContent = "Research stopped";
  setMemoryStatus("stopped", "Stopped");
  for (const node of document.querySelectorAll('.team-node[data-status="running"]')) {
    nodeState(node.dataset.node, "error", "Stopped");
  }
  for (const path of document.querySelectorAll('[data-wire][data-status="running"]')) delete path.dataset.status;
}

const markdownText = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export function recentResearchNotes() {
  return memory.slice(-12).map(({ turn, author, text }) => `${turn ? `Turn ${turn}` : "Setup"} · ${author} · ${text}`.slice(0, 500));
}

export function researchMemory() {
  const lines = ["# Gift Search memory", "", markdownText(teamMode.textContent)];
  if (!turnLabel.hidden) lines.push("", markdownText(turnLabel.textContent));
  if (teamHistory.length) {
    const { reviewer } = teamHistory[0];
    lines.push("", "## Personas", "", `Reviewer · ${markdownText(reviewer.name)} · ${markdownText(reviewer.persona)}`);
    for (const { turn, scouts } of teamHistory) {
      lines.push("", `### Turn ${turn}`, "");
      for (const role of scouts) lines.push(`- ${markdownText(role.name)} · ${markdownText(role.persona)}`);
    }
  }
  lines.push("", "## Research memory", "");
  for (const message of memory) {
    const source = productUrl(message.url);
    const label = message.turn ? `Turn ${message.turn}` : "Setup";
    const category = memoryLabels[message.type] ?? "Note";
    lines.push(`- ${label} · ${markdownText(message.author)} · ${category} · ${markdownText(message.text)}${source ? ` <${source.href}>` : ""}`);
  }
  return lines.join("\n") + "\n";
}

export async function consumeEvents(response, receive) {
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "The request failed.");
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      buffer += chunk.value;
      const rows = buffer.split("\n");
      buffer = rows.pop();
      for (const row of rows) {
        if (!row) continue;
        const event = JSON.parse(row);
        if (event.kind === "error") throw new Error(event.error);
        receive(event);
      }
    }
    if (buffer.trim()) throw new Error("The agent stream ended early.");
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

export async function replayTimeline(events, mode, count, { demo = false, consoleLabel, completed = true } = {}) {
  resetTeam(mode, { expand: true, demo, consoleLabel });
  for (const event of events) {
    showTeamEvent(event);
    const delay = event.kind === "board-post" || event.kind.startsWith("claude-") ? 75 : 330;
    await new Promise((done) => setTimeout(done, delay));
  }
  if (completed) finishTeam(count);
  else stopTeam();
}
