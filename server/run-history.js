import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const historyDir = resolve(process.env.GIFT_HISTORY_DIR?.trim() || join(homedir(), ".local", "state", "gift-search", "runs"));
const runIdPattern = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;

export function newRun(brief, harness, report) {
  const createdAt = new Date().toISOString();
  return {
    id: randomUUID(), version: 1, harness, brief, report, createdAt, updatedAt: createdAt,
    status: "running", completedTurns: 0, checkpoint: null, committedEvents: 0, events: [],
  };
}

export async function saveRun(record) {
  await mkdir(historyDir, { recursive: true, mode: 0o700 });
  const temporary = join(historyDir, `.${record.id}.${randomUUID()}.tmp`);
  const file = join(historyDir, `${record.id}.json`);
  record.updatedAt = new Date().toISOString();
  try {
    await writeFile(temporary, JSON.stringify(record) + "\n", { mode: 0o600, flag: "wx" });
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

export async function loadRun(id) {
  if (typeof id !== "string" || !runIdPattern.test(id)) return null;
  try {
    const record = JSON.parse(await readFile(join(historyDir, `${id}.json`), "utf8"));
    if (record?.version === 1 && record.id === id && record.brief && Array.isArray(record.report?.gifts)
        && Array.isArray(record.events) && Number.isInteger(record.committedEvents)) return record;
    return null;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export function runSummary(record, activeRunId) {
  const { id, harness, brief, status, completedTurns, createdAt, updatedAt } = record;
  return {
    id, harness, recipient: brief.recipient, occasion: brief.occasion, interests: brief.interests,
    status: status === "running" && id !== activeRunId ? "interrupted" : status,
    completedTurns, createdAt, updatedAt, gifts: record.report.gifts.length,
  };
}

export async function listRuns(activeRunId) {
  const files = await readdir(historyDir).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const records = await Promise.all(files
    .filter((file) => file.endsWith(".json"))
    .map((file) => loadRun(file.slice(0, -5)).catch(() => null)));
  return records.filter(Boolean).map((record) => runSummary(record, activeRunId))
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
}
