import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { MCPCliTool, MCPTransportMode } from "../../src/types/agent-settings";

const MCP_HOST = "http://127.0.0.1:3100/mcp";

export function getManagedMcpConfigPath(tool: MCPCliTool): string {
  return join(homedir(), ".game-theory-analyzer", "mcp", `${tool}.json`);
}

function buildStdioConfig() {
  return {
    command: "bun",
    args: ["run", "src/mcp/server.ts", "--stdio"],
    cwd: process.cwd(),
  };
}

function buildHttpConfig() {
  return {
    type: "http",
    url: MCP_HOST,
  };
}

function buildSnippet(tool: MCPCliTool, transportMode: MCPTransportMode) {
  const servers =
    transportMode === "both"
      ? {
          "game-theory-analyzer-stdio": buildStdioConfig(),
          "game-theory-analyzer-http": buildHttpConfig(),
        }
      : {
          "game-theory-analyzer":
            transportMode === "http" ? buildHttpConfig() : buildStdioConfig(),
        };

  return {
    generated_at: new Date().toISOString(),
    tool,
    transport_mode: transportMode,
    mcpServers: servers,
  };
}

export async function writeManagedMcpConfig(
  tool: MCPCliTool,
  transportMode: MCPTransportMode,
): Promise<string> {
  const outputPath = getManagedMcpConfigPath(tool);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    JSON.stringify(buildSnippet(tool, transportMode), null, 2),
    "utf-8",
  );
  return outputPath;
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
