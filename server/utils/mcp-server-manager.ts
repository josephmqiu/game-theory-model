import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MCP_HTTP_HOST, getMcpServerStatus } from "../mcp/mcp-server";

function resolveModuleDirname(): string {
  const importMetaUrl =
    typeof import.meta !== "undefined" ? import.meta.url : undefined;
  if (typeof importMetaUrl === "string") {
    return dirname(fileURLToPath(importMetaUrl));
  }
  if (typeof __dirname === "string") {
    return __dirname;
  }
  return process.cwd();
}

const __dirname = resolveModuleDirname();

export function resolveMcpProxyScript(): string {
  const candidatePaths: string[] = [];
  const electronResources = process.env.ELECTRON_RESOURCES_PATH;
  if (electronResources) {
    const resourcePath = join(electronResources, "mcp-stdio-proxy.cjs");
    candidatePaths.push(resourcePath);
    if (existsSync(resourcePath)) return resourcePath;
  }

  const fromCwd = resolve(process.cwd(), "dist", "mcp-stdio-proxy.cjs");
  candidatePaths.push(fromCwd);
  if (existsSync(fromCwd)) return fromCwd;

  const fromFile = resolve(
    __dirname,
    "..",
    "..",
    "..",
    "dist",
    "mcp-stdio-proxy.cjs",
  );
  candidatePaths.push(fromFile);
  if (existsSync(fromFile)) return fromFile;

  throw new Error(
    [
      "Missing MCP stdio proxy build artifact.",
      "Expected one of:",
      ...candidatePaths.map((candidate) => `- ${candidate}`),
      'Launch the desktop runtime so it can compile/package "dist/mcp-stdio-proxy.cjs".',
      'Plain "bun run dev" is not a supported Codex/Claude runtime path.',
    ].join("\n"),
  );
}

export function getStatus(): {
  running: boolean;
  port: number | null;
  localIp: string | null;
  available: boolean;
  mcpAvailable: boolean;
} {
  const status = getMcpServerStatus();

  return {
    running: status.available,
    port: status.port,
    localIp: status.available ? MCP_HTTP_HOST : null,
    available: status.available,
    mcpAvailable: status.available,
  };
}
