// codex-mcp-registration.ts — register the in-process MCP server with the
// Codex CLI at explicit setup time (decision 10, OpenPencil pattern).
//
// Primary path: the official `codex mcp add <name> --url <url>` command,
// which owns ~/.codex/config.toml on Codex's terms. Fallback for old CLIs
// that predate the `mcp` subcommand: a guarded WRITE-ONCE entry via the
// legacy TOML writer (never rewritten per run — runs perform zero config
// writes).

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { serverLog, serverWarn } from "../../utils/ai-logger";
import { resolveMcpProxyScript } from "../../utils/mcp-server-manager";
import {
  CODEX_MCP_SERVER_NAME,
  installMcpServer,
  isInstalled,
  uninstallMcpServer,
} from "./codex-config";

const execFileAsync = promisify(execFile);

const CLI_TIMEOUT_MS = 15_000;

export type CodexRegistrationMethod = "cli" | "config-file";

export interface CodexRegistrationResult {
  method: CodexRegistrationMethod;
}

/** True when the installed Codex CLI supports the `codex mcp` subcommand. */
export async function detectCodexMcpCli(): Promise<boolean> {
  try {
    await execFileAsync("codex", ["mcp", "--help"], {
      timeout: CLI_TIMEOUT_MS,
    });
    return true;
  } catch {
    return false;
  }
}

function resolveMcpProxyCommand(): string {
  // In Electron, process.execPath is the Electron binary (GUI app), not a
  // Node.js runtime. Codex needs a real Node binary to spawn the stdio
  // proxy subprocess in the legacy fallback path.
  if (process.env.ELECTRON_RESOURCES_PATH) return "node";
  return process.release?.name === "node" ? process.execPath : "node";
}

/**
 * Register the MCP server with Codex, pointed at the (dynamic) HTTP port.
 * Idempotent: re-registering after a port change replaces the entry.
 */
export async function registerCodexMcpServer(
  url: string,
): Promise<CodexRegistrationResult> {
  if (await detectCodexMcpCli()) {
    // Remove-then-add so URL/port changes take effect; remove failing
    // because the entry doesn't exist yet is expected.
    await execFileAsync("codex", ["mcp", "remove", CODEX_MCP_SERVER_NAME], {
      timeout: CLI_TIMEOUT_MS,
    }).catch(() => {});
    await execFileAsync(
      "codex",
      ["mcp", "add", CODEX_MCP_SERVER_NAME, "--url", url],
      { timeout: CLI_TIMEOUT_MS },
    );
    serverLog(undefined, "codex-mcp-registration", "registered-via-cli", {
      url,
    });
    return { method: "cli" };
  }

  // Old CLI without `codex mcp` — guarded write-once fallback using the
  // stdio proxy (old CLIs also predate streamable-HTTP --url support).
  if (!isInstalled()) {
    installMcpServer(resolveMcpProxyCommand(), [resolveMcpProxyScript()]);
    serverLog(undefined, "codex-mcp-registration", "registered-via-config", {
      reason: "codex mcp subcommand unavailable",
    });
  } else {
    serverLog(undefined, "codex-mcp-registration", "already-registered", {
      method: "config-file",
    });
  }
  return { method: "config-file" };
}

export async function unregisterCodexMcpServer(): Promise<void> {
  if (await detectCodexMcpCli()) {
    try {
      await execFileAsync("codex", ["mcp", "remove", CODEX_MCP_SERVER_NAME], {
        timeout: CLI_TIMEOUT_MS,
      });
      return;
    } catch (error) {
      serverWarn(undefined, "codex-mcp-registration", "cli-remove-failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  uninstallMcpServer();
}
