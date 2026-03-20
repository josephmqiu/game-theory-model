import {
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export const CODEX_MCP_SERVER_NAME = "game-theory-analyzer";
const CONFIG_FILENAME = "config.toml";
const LOCK_FILENAME = "config.toml.lock";
const CODEX_DIR = ".codex";

interface InstallMcpServerOptions {
  enabledTools?: string[];
  env?: Record<string, string>;
  startupTimeoutSec?: number;
  toolTimeoutSec?: number;
}

// ── Paths ──

function codexDir(): string {
  return join(homedir(), CODEX_DIR);
}

function configPath(): string {
  return join(codexDir(), CONFIG_FILENAME);
}

function lockPath(): string {
  return join(codexDir(), LOCK_FILENAME);
}

// ── Minimal TOML helpers ──
// Codex config.toml uses [mcp_servers.<name>] sections with simple key=value pairs.
// We parse/write just enough to merge our entry without a TOML library.

/**
 * Parse a TOML string into a map of section headers to their raw content lines.
 * Returns { sections, sectionOrder } where sections maps header -> lines[].
 * Lines before any section header go under the empty-string key.
 */
function parseSections(toml: string): {
  sections: Map<string, string[]>;
  sectionOrder: string[];
} {
  const sections = new Map<string, string[]>();
  const sectionOrder: string[] = [];
  let current = "";
  sections.set(current, []);
  sectionOrder.push(current);

  for (const line of toml.split("\n")) {
    const match = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (match) {
      current = match[1];
      if (!sections.has(current)) {
        sections.set(current, []);
        sectionOrder.push(current);
      }
    } else {
      sections.get(current)!.push(line);
    }
  }
  return { sections, sectionOrder };
}

/** Serialize sections back to TOML text. */
function serializeSections(
  sections: Map<string, string[]>,
  sectionOrder: string[],
): string {
  const parts: string[] = [];
  for (const key of sectionOrder) {
    const lines = sections.get(key);
    if (!lines) continue;
    if (key !== "") {
      parts.push(`[${key}]`);
    }
    parts.push(...lines);
  }
  // Ensure single trailing newline
  let result = parts.join("\n");
  result = result.replace(/\n+$/, "") + "\n";
  return result;
}

function formatStringArray(values: string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}

function formatInlineTable(values: Record<string, string>): string {
  const entries = Object.entries(values)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key} = ${JSON.stringify(value)}`);
  return `{ ${entries.join(", ")} }`;
}

/** Build the lines for our MCP server entry (without the section header). */
function mcpEntryLines(
  command: string,
  args: string[],
  options?: InstallMcpServerOptions,
): string[] {
  const env = {
    PRODUCT_ONLY: "1",
    ...(options?.env ?? {}),
  };

  const lines = [
    `command = ${JSON.stringify(command)}`,
    `args = ${formatStringArray(args)}`,
    `startup_timeout_sec = ${options?.startupTimeoutSec ?? 10}`,
    `tool_timeout_sec = ${options?.toolTimeoutSec ?? 120}`,
    `env = ${formatInlineTable(env)}`,
  ];

  if (options?.enabledTools && options.enabledTools.length > 0) {
    lines.push(`enabled_tools = ${formatStringArray(options.enabledTools)}`);
  }

  lines.push("");
  return lines;
}

// ── Lockfile ──

function acquireLock(): void {
  const lock = lockPath();
  const dir = codexDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  // Simple lockfile: write PID. Not bulletproof but sufficient for desktop app.
  writeFileSync(lock, String(process.pid), { flag: "wx" });
}

function releaseLock(): void {
  const lock = lockPath();
  try {
    unlinkSync(lock);
  } catch {
    // Already removed or never created — fine
  }
}

function withLock<T>(fn: () => T): T {
  acquireLock();
  try {
    return fn();
  } finally {
    releaseLock();
  }
}

// ── Public API ──

const SECTION_KEY = `mcp_servers.${CODEX_MCP_SERVER_NAME}`;

/**
 * Add the game-theory-analyzer MCP server entry to ~/.codex/config.toml.
 * Preserves all existing entries. Creates the file + directory if needed.
 */
export function installMcpServer(
  serverCommand: string,
  serverArgs: string[],
  options?: InstallMcpServerOptions,
): void {
  withLock(() => {
    const file = configPath();
    const dir = codexDir();

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    let content = "";
    if (existsSync(file)) {
      content = readFileSync(file, "utf-8");
    }

    const { sections, sectionOrder } = parseSections(content);

    // Replace or add our section
    sections.set(SECTION_KEY, mcpEntryLines(serverCommand, serverArgs, options));
    if (!sectionOrder.includes(SECTION_KEY)) {
      sectionOrder.push(SECTION_KEY);
    }

    writeFileSync(file, serializeSections(sections, sectionOrder), "utf-8");
  });
}

export function getCodexConfigPath(): string {
  return configPath();
}

/**
 * Remove the game-theory-analyzer MCP server entry from ~/.codex/config.toml.
 * Preserves all other entries. No-op if file or entry doesn't exist.
 */
export function uninstallMcpServer(): void {
  const file = configPath();
  if (!existsSync(file)) return;

  try {
    const content = readFileSync(file, "utf-8");
    const { sections, sectionOrder } = parseSections(content);

    if (!sections.has(SECTION_KEY)) return;

    sections.delete(SECTION_KEY);
    const filtered = sectionOrder.filter((k) => k !== SECTION_KEY);

    writeFileSync(file, serializeSections(sections, filtered), "utf-8");
  } catch {
    // Config unreadable or write failed — best-effort cleanup
  }

  releaseLock();
}

/**
 * Check whether the game-theory-analyzer entry exists in config.toml.
 */
export function isInstalled(): boolean {
  const file = configPath();
  if (!existsSync(file)) return false;
  try {
    const content = readFileSync(file, "utf-8");
    return content.includes(`[${SECTION_KEY}]`);
  } catch {
    return false;
  }
}

/**
 * Register process signal/exit handlers that call uninstallMcpServer() on shutdown.
 * Returns a cleanup function that removes the handlers.
 */
export function registerCleanupHandler(): () => void {
  const handler = () => {
    uninstallMcpServer();
  };

  process.on("SIGTERM", handler);
  process.on("SIGINT", handler);
  process.on("beforeExit", handler);

  return () => {
    process.off("SIGTERM", handler);
    process.off("SIGINT", handler);
    process.off("beforeExit", handler);
  };
}
