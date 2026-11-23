import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";
import { validateReport } from "./report.mjs";

const run = promisify(execFile);
const marker = "<!-- GIFT_REPORT_DATA -->";

async function writeDashboard(report, reportPath, output) {
  const asset = new URL("../assets/dashboard.html", import.meta.url);
  const template = await readFile(asset, "utf8");
  // Escape tag openers so text in the report stays inside the JSON script element.
  const json = JSON.stringify(report).replaceAll("<", "\\u003c");
  const html = template.replace(marker, () => `<script id="initial-report" type="application/json">${json}</script>`);
  const path = output ? resolve(output) : join(dirname(reportPath), "gift-dashboard.html");
  try {
    await writeFile(path, html, { flag: "wx" });
    return path;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    if (output) throw new Error("The requested dashboard file already exists.");
    const next = join(dirname(path), `gift-dashboard-${randomUUID().slice(0, 8)}.html`);
    await writeFile(next, html, { flag: "wx" });
    return next;
  }
}

function dashboardTarget(value, report) {
  const url = new URL(value);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))) {
    throw new Error("Use an HTTPS dashboard URL or an HTTP loopback address.");
  }
  url.hash = "report=" + encodeURIComponent(JSON.stringify(report));
  return url.href;
}

async function openBrowser(target) {
  const command = {
    darwin: ["open", target],
    linux: ["xdg-open", target],
    win32: ["rundll32.exe", "url.dll,FileProtocolHandler", target],
  }[process.platform];
  if (!command) return false;
  const [program, ...args] = command;
  try {
    await run(program, args, { timeout: 5000, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { output: { type: "string" }, "dashboard-url": { type: "string" }, "no-open": { type: "boolean" } },
  });
  if (positionals.length !== 1) {
    throw new Error("Usage: node open-dashboard.mjs <gift-report.json> [--output <file> | --dashboard-url <url>] [--no-open]");
  }
  const input = resolve(positionals[0]);
  let report;
  try {
    report = JSON.parse(await readFile(input, "utf8"));
  } catch {
    throw new Error("Could not read the gift report as JSON.");
  }
  validateReport(report);

  if (values["dashboard-url"]) {
    const target = dashboardTarget(values["dashboard-url"], report);
    if (!values["no-open"] && await openBrowser(target)) {
      console.log("Opened the dashboard with the gift report.");
      return;
    }
    if (values["no-open"]) {
      console.log(target);
      return;
    }
  }

  const file = await writeDashboard(report, input, values.output);
  console.log(file);
  if (!values["no-open"] && !await openBrowser(pathToFileURL(file).href)) {
    console.error("Open the dashboard file in a browser to view the report.");
  }
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
