import { execFile } from "node:child_process";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import type { MCPCliTool, MCPTransportMode } from "../../src/types/agent-settings";

const execFileAsync = promisify(execFile);
const MCP_HOST = "http://127.0.0.1:3100/mcp";
const STDIO_SMOKE_TIMEOUT_MS = 1200;

interface StdioRuntimeConfig {
  command: string;
  args: string[];
  cwd: string;
  bundlePath: string;
  runtimeTarget: "dev" | "packaged";
}

interface HttpRuntimeConfig {
  type: "http";
  url: string;
}

export interface ManagedMcpConfigWriteResult {
  outputPath: string;
  requestedTransportMode: MCPTransportMode;
  effectiveTransportMode: MCPTransportMode;
  runtimeTarget: "dev" | "packaged";
  reachable: boolean;
}

function getRepoRoot(): string {
  return process.cwd();
}

function getPackagedBundlePath(): string | null {
  const resourcesPath = process.env.ELECTRON_RESOURCES_PATH;
  return resourcesPath ? join(resourcesPath, "mcp-server.cjs") : null;
}

function getDevBundlePath(): string {
  return join(getRepoRoot(), "dist", "mcp-server.cjs");
}

async function fileExists(path: string | null): Promise<boolean> {
  if (!path) return false;
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function ensureDevBundle(): Promise<string> {
  const bundlePath = getDevBundlePath();
  if (await fileExists(bundlePath)) {
    return bundlePath;
  }

  await execFileAsync("bun", ["run", "mcp:compile"], {
    cwd: getRepoRoot(),
    timeout: 120_000,
  });

  if (!(await fileExists(bundlePath))) {
    throw new Error("Compiled MCP server bundle was not created.");
  }

  return bundlePath;
}

async function resolveStdioRuntimeConfig(): Promise<StdioRuntimeConfig> {
  const packagedBundlePath = getPackagedBundlePath();
  if (await fileExists(packagedBundlePath)) {
    return {
      command: process.execPath,
      args: [packagedBundlePath!, "--stdio"],
      cwd: dirname(packagedBundlePath!),
      bundlePath: packagedBundlePath!,
      runtimeTarget: "packaged",
    };
  }

  const bundlePath = await ensureDevBundle();
  return {
    command: process.execPath,
    args: [bundlePath, "--stdio"],
    cwd: getRepoRoot(),
    bundlePath,
    runtimeTarget: "dev",
  };
}

async function isHttpTransportReachable(): Promise<boolean> {
  try {
    const response = await fetch(MCP_HOST, {
      method: "OPTIONS",
    });
    return response.ok;
  } catch {
    return false;
  }
}

function buildStdioConfig(runtime: StdioRuntimeConfig) {
  return {
    command: runtime.command,
    args: runtime.args,
    cwd: runtime.cwd,
  };
}

function buildHttpConfig(): HttpRuntimeConfig {
  return {
    type: "http",
    url: MCP_HOST,
  };
}

async function resolveEffectiveTransportMode(
  requested: MCPTransportMode,
): Promise<MCPTransportMode> {
  if (requested === "stdio") return "stdio";

  const httpReachable = await isHttpTransportReachable();
  if (!httpReachable) {
    return "stdio";
  }

  return requested;
}

async function buildSnippet(
  tool: MCPCliTool,
  requestedTransportMode: MCPTransportMode,
) {
  const runtime = await resolveStdioRuntimeConfig();
  const effectiveTransportMode = await resolveEffectiveTransportMode(
    requestedTransportMode,
  );

  const servers =
    effectiveTransportMode === "both"
      ? {
          "game-theory-analyzer-stdio": buildStdioConfig(runtime),
          "game-theory-analyzer-http": buildHttpConfig(),
        }
      : {
          "game-theory-analyzer":
            effectiveTransportMode === "http"
              ? buildHttpConfig()
              : buildStdioConfig(runtime),
        };

  return {
    runtime,
    effectiveTransportMode,
    snippet: {
      generated_at: new Date().toISOString(),
      tool,
      requested_transport_mode: requestedTransportMode,
      transport_mode: effectiveTransportMode,
      mcpServers: servers,
    },
  };
}

export function getManagedMcpConfigPath(tool: MCPCliTool): string {
  return join(homedir(), ".game-theory-analyzer", "mcp", `${tool}.json`);
}

export async function smokeTestManagedMcpStdio(): Promise<{
  reachable: boolean;
  runtimeTarget: "dev" | "packaged";
  error?: string;
}> {
  let child: ReturnType<typeof import("node:child_process").spawn> | null = null;

  try {
    const runtime = await resolveStdioRuntimeConfig();
    const { spawn } = await import("node:child_process");

    child = spawn(runtime.command, runtime.args, {
      cwd: runtime.cwd,
      stdio: "pipe",
      env: process.env,
    });

    const result = await new Promise<{ reachable: boolean; error?: string }>(
      (resolve) => {
        let settled = false;
        const settle = (payload: { reachable: boolean; error?: string }) => {
          if (settled) return;
          settled = true;
          resolve(payload);
        };

        child?.once("error", (error) => {
          settle({
            reachable: false,
            error: error.message,
          });
        });

        child?.once("exit", (code, signal) => {
          settle({
            reachable: false,
            error: `MCP stdio process exited early (code=${code}, signal=${signal}).`,
          });
        });

        setTimeout(() => {
          settle({ reachable: true });
        }, STDIO_SMOKE_TIMEOUT_MS);
      },
    );

    return {
      runtimeTarget: runtime.runtimeTarget,
      ...result,
    };
  } catch (error) {
    return {
      reachable: false,
      runtimeTarget: process.env.ELECTRON_RESOURCES_PATH ? "packaged" : "dev",
      error: error instanceof Error ? error.message : "Failed to start MCP stdio runtime.",
    };
  } finally {
    child?.kill("SIGTERM");
  }
}

export async function writeManagedMcpConfig(
  tool: MCPCliTool,
  transportMode: MCPTransportMode,
): Promise<ManagedMcpConfigWriteResult> {
  const outputPath = getManagedMcpConfigPath(tool);
  const { runtime, effectiveTransportMode, snippet } = await buildSnippet(
    tool,
    transportMode,
  );
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(snippet, null, 2), "utf-8");

  const smoke = await smokeTestManagedMcpStdio();
  return {
    outputPath,
    requestedTransportMode: transportMode,
    effectiveTransportMode,
    runtimeTarget: runtime.runtimeTarget,
    reachable: smoke.reachable,
  };
}

export async function deleteManagedMcpConfig(tool: MCPCliTool): Promise<void> {
  await rm(getManagedMcpConfigPath(tool), { force: true });
}

export async function hasManagedMcpConfig(tool: MCPCliTool): Promise<boolean> {
  try {
    await stat(getManagedMcpConfigPath(tool));
    return true;
  } catch {
    return false;
  }
}
