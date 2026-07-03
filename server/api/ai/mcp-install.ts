import { defineEventHandler, readBody, setResponseHeaders } from "h3";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { MCP_DEFAULT_PORT } from "../../../src/constants/app";
import { getCodexConfigPath } from "../../services/ai/codex-config";
import {
  registerCodexMcpServer,
  unregisterCodexMcpServer,
} from "../../services/ai/codex-mcp-registration";
import { getMcpServerStatus } from "../../mcp/mcp-server";

interface InstallBody {
  tool: string;
  action: "install" | "uninstall";
  transportMode?: "stdio" | "http" | "both";
  httpPort?: number;
}

interface InstallResult {
  success: boolean;
  error?: string;
  configPath?: string;
  /** How the codex registration landed: official CLI or legacy config file. */
  method?: "cli" | "config-file";
}

const MCP_SERVER_NAME = "game-theory-analyzer";
const UNSUPPORTED_CLI_ERROR =
  "This CLI is not yet supported with the in-process MCP server.";

function buildClaudeHttpEntry(port: number): { type: "http"; url: string } {
  return {
    type: "http",
    url: `http://127.0.0.1:${port}/mcp`,
  };
}

async function readJsonConfig(
  filePath: string,
): Promise<Record<string, unknown>> {
  try {
    const text = await readFile(filePath, "utf-8");
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function writeJsonConfig(
  filePath: string,
  config: Record<string, unknown>,
): Promise<void> {
  const parentDir = dirname(filePath);
  if (!existsSync(parentDir)) {
    await mkdir(parentDir, { recursive: true });
  }
  await writeFile(filePath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

function installClaudeCodeMcp(
  config: Record<string, unknown>,
  port: number,
): Record<string, unknown> {
  const mcpServers =
    config.mcpServers && typeof config.mcpServers === "object"
      ? (config.mcpServers as Record<string, unknown>)
      : {};

  return {
    ...config,
    mcpServers: {
      ...mcpServers,
      [MCP_SERVER_NAME]: buildClaudeHttpEntry(port),
    },
  };
}

function uninstallClaudeCodeMcp(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const mcpServers =
    config.mcpServers && typeof config.mcpServers === "object"
      ? { ...(config.mcpServers as Record<string, unknown>) }
      : {};

  delete mcpServers[MCP_SERVER_NAME];

  return {
    ...config,
    mcpServers: Object.keys(mcpServers).length > 0 ? mcpServers : undefined,
  };
}

export default defineEventHandler(async (event) => {
  const body = await readBody<InstallBody>(event);
  setResponseHeaders(event, { "Content-Type": "application/json" });

  if (!body?.tool || !body?.action) {
    return {
      success: false,
      error: "Missing tool or action field",
    } satisfies InstallResult;
  }

  // Prefer the ACTUAL bound port of the in-process server (it may be
  // dynamically assigned when the default is taken), then the caller's
  // hint, then the default.
  const serverStatus = getMcpServerStatus();
  const port =
    (serverStatus.available ? serverStatus.port : undefined) ??
    body.httpPort ??
    MCP_DEFAULT_PORT;

  try {
    if (body.tool === "codex-cli") {
      if (body.action === "uninstall") {
        await unregisterCodexMcpServer();
        return {
          success: true,
          configPath: getCodexConfigPath(),
        } satisfies InstallResult;
      }

      const registration = await registerCodexMcpServer(
        `http://127.0.0.1:${port}/mcp`,
      );

      return {
        success: true,
        method: registration.method,
        configPath: getCodexConfigPath(),
      } satisfies InstallResult;
    }

    if (body.tool === "claude-code") {
      const configPath = join(homedir(), ".claude.json");
      const config = await readJsonConfig(configPath);
      const updated =
        body.action === "uninstall"
          ? uninstallClaudeCodeMcp(config)
          : installClaudeCodeMcp(config, port);

      await writeJsonConfig(configPath, updated);

      return {
        success: true,
        configPath,
      } satisfies InstallResult;
    }

    return {
      success: false,
      error: UNSUPPORTED_CLI_ERROR,
    } satisfies InstallResult;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies InstallResult;
  }
});
