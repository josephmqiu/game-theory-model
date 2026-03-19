import {
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const MCP_KEY = "game-theory-analyzer";
const CONFIG_FILENAME = "config.toml";
const LOCK_FILENAME = "config.toml.lock";
const CODEX_DIR = ".codex";

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

/** Build the lines for our MCP server entry (without the section header). */
function mcpEntryLines(command: string, args: string[]): string[] {
  const argsStr = args.map((a) => `"${a}"`).join(", ");
  return [
    `command = "${command}"`,
    `args = [${argsStr}]`,
    `startup_timeout_sec = 10`,
    `tool_timeout_sec = 120`,
    "",
  ];
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

const SECTION_KEY = `mcp_servers.${MCP_KEY}`;

/**
 * Add the game-theory-analyzer MCP server entry to ~/.codex/config.toml.
 * Preserves all existing entries. Creates the file + directory if needed.
 */
export function installMcpServer(
  serverCommand: string,
  serverArgs: string[],
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
    sections.set(SECTION_KEY, mcpEntryLines(serverCommand, serverArgs));
    if (!sectionOrder.includes(SECTION_KEY)) {
      sectionOrder.push(SECTION_KEY);
    }

    writeFileSync(file, serializeSections(sections, sectionOrder), "utf-8");
  });
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
