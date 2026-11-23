import { accessSync, constants, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

export const harnesses = {
  claude: { label: "Claude Code", override: "CLAUDE_ACP_EXECUTABLE", package: "@agentclientprotocol/claude-agent-acp@0.109.0", binary: "claude-agent-acp" },
  codex: { label: "Codex", override: "CODEX_ACP_EXECUTABLE", package: "@agentclientprotocol/codex-acp@2.9.0", binary: "codex-acp", mode: "read-only" },
  cursor: { label: "Cursor", override: "CURSOR_ACP_EXECUTABLE", binary: "cursor-agent", args: ["acp"], mode: "ask" },
  opencode: { label: "OpenCode", override: "OPENCODE_ACP_EXECUTABLE", binary: "opencode", args: ["acp", "--pure"], mode: "plan" },
  caipe: { label: "CAIPE", override: "CAIPE_ACP_EXECUTABLE", binary: "caipe", args: ["acp", "--no-context"] },
};

function executable(command) {
  if (!command) return null;
  const candidates = /[/\\]/.test(command) ? [command]
    : (process.env.PATH ?? "").split(delimiter).filter(Boolean).map((path) => join(path, command));
  for (const path of candidates) {
    try {
      accessSync(path, constants.X_OK);
      return path;
    } catch {
      // Keep looking on PATH.
    }
  }
  return null;
}

export function harnessCommand(id) {
  const config = harnesses[id];
  const override = process.env[config.override];
  if (override) {
    const command = executable(override);
    return command ? [command] : null;
  }
  const binary = executable(config.binary) ?? (id === "cursor" ? executable("agent") : null);
  if (binary) {
    const args = config.args ?? [];
    const agent = id === "caipe" && process.env.GIFT_CAIPE_AGENT?.trim();
    return [binary, ...args, ...(agent ? ["--agent", agent] : [])];
  }
  if (config.package && process.env.npm_execpath) {
    return [process.execPath, process.env.npm_execpath, "exec", "--yes", "--quiet", `--package=${config.package}`, "--", config.binary];
  }
  return null;
}

export function availableHarnesses() {
  return Object.entries(harnesses).map(([id, { label }]) => ({ id, label, available: Boolean(harnessCommand(id)) }));
}

function openCodeConfig(text) {
  const strings = /"(?:[^"\\]|\\[\s\S])*"|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g;
  const unquotedTrailingCommas = /"(?:[^"\\]|\\[\s\S])*"|,(?=\s*[}\]])/g;
  return JSON.parse(text.replace(strings, (match) => match.startsWith('"') ? match : "")
    .replace(unquotedTrailingCommas, (match) => match === "," ? "" : match));
}

function isolateOpenCodeTools(env) {
  const inline = openCodeConfig(env.OPENCODE_CONFIG_CONTENT || "{}");
  const dirs = [join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "opencode"), env.OPENCODE_CONFIG_DIR].filter(Boolean);
  const files = [...dirs.flatMap((dir) => ["opencode.json", "opencode.jsonc"].map((name) => join(dir, name))), env.OPENCODE_CONFIG].filter(Boolean);
  const configs = files.flatMap((file) => {
    try {
      return [openCodeConfig(readFileSync(file, "utf8"))];
    } catch {
      return [];
    }
  });
  configs.push(inline);
  const flat = new Set();
  const nested = new Set();
  for (const { mcp = {} } of configs) {
    for (const [id, server] of Object.entries(mcp)) {
      if (id === "servers") {
        for (const name of Object.keys(server ?? {})) nested.add(name);
      } else if (server && typeof server === "object") flat.add(id);
    }
  }
  const disabled = (ids) => Object.fromEntries([...ids].map((id) => [id, { enabled: false }]));
  env.OPENCODE_CONFIG_CONTENT = JSON.stringify({
    ...inline, share: "disabled", permission: { "*": "deny" },
    mcp: { ...inline.mcp, ...disabled(flat), ...(nested.size && { servers: disabled(nested) }) },
  });
}

export function harnessEnvironment(id) {
  const env = { ...process.env };
  for (const key of ["SERPAPI_API_KEY", "SERPAPI_API_KEY_FILE", "GIFT_HISTORY_DIR"]) delete env[key];
  if (id === "claude") {
    for (const key of [
      "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL", "ANTHROPIC_MODEL",
      "ANTHROPIC_DEFAULT_HAIKU_MODEL", "ANTHROPIC_DEFAULT_SONNET_MODEL", "ANTHROPIC_DEFAULT_OPUS_MODEL",
      "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY", "OPENAI_API_KEY",
    ]) delete env[key];
  }
  if (id === "codex") {
    env.INITIAL_AGENT_MODE = "read-only";
    env.NO_BROWSER = "1";
  }
  if (id === "opencode") {
    isolateOpenCodeTools(env);
  }
  return env;
}
