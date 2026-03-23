import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";
import { Server as McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import pkg from "../../package.json";
import { MCP_DEFAULT_PORT } from "../../src/constants/app";
import { registerProductTools } from "./product-tools";

export const MCP_HTTP_HOST = "127.0.0.1";

export interface InProcessMcpServerHandle {
  available: boolean;
  port: number;
  close: () => Promise<void>;
}

interface McpServerState {
  available: boolean;
  port: number;
}

interface ActiveMcpServerState {
  close: () => Promise<void>;
  port: number;
  server: ReturnType<typeof createServer>;
}

let activeServer: ActiveMcpServerState | null = null;

const GLOBAL_MCP_SERVER_KEY = "__gameTheoryAnalyzerMcpServer";

type GlobalMcpServerState = ActiveMcpServerState | null;

function getGlobalServerState(): GlobalMcpServerState {
  const globalScope = globalThis as typeof globalThis & {
    [GLOBAL_MCP_SERVER_KEY]?: GlobalMcpServerState;
  };

  if (globalScope[GLOBAL_MCP_SERVER_KEY] !== undefined) {
    return globalScope[GLOBAL_MCP_SERVER_KEY] ?? null;
  }

  globalScope[GLOBAL_MCP_SERVER_KEY] = activeServer;
  return globalScope[GLOBAL_MCP_SERVER_KEY] ?? null;
}

function setGlobalServerState(nextState: GlobalMcpServerState): void {
  activeServer = nextState;
  const globalScope = globalThis as typeof globalThis & {
    [GLOBAL_MCP_SERVER_KEY]?: GlobalMcpServerState;
  };
  globalScope[GLOBAL_MCP_SERVER_KEY] = nextState;
}

function createProductServer(): McpServer {
  const server = new McpServer(
    { name: pkg.name, version: pkg.version },
    { capabilities: { tools: {} } },
  );
  registerProductTools(server);
  return server;
}

function getAllowedHosts(port: number): string[] {
  return [`${MCP_HTTP_HOST}:${port}`, `localhost:${port}`];
}

function writeJson(
  res: ServerResponse,
  statusCode: number,
  body: Record<string, unknown>,
): void {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function isAllowedHost(req: IncomingMessage, port: number): boolean {
  const hostHeader = req.headers.host;
  return typeof hostHeader === "string" && getAllowedHosts(port).includes(hostHeader);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  port: number,
): Promise<void> {
  if (!isAllowedHost(req, port)) {
    writeJson(res, 403, { error: "Forbidden host header" });
    return;
  }

  if (req.url !== "/mcp") {
    writeJson(res, 404, { error: "Not found. Use /mcp endpoint." });
    return;
  }

  if (req.method !== "POST") {
    writeJson(res, 405, { error: "Method not allowed. Use POST /mcp." });
    return;
  }

  let parsedBody: unknown;
  try {
    parsedBody = await readJsonBody(req);
  } catch {
    writeJson(res, 400, {
      jsonrpc: "2.0",
      error: { code: -32700, message: "Parse error" },
      id: null,
    });
    return;
  }

  const server = createProductServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    allowedHosts: getAllowedHosts(port),
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, parsedBody);
  } finally {
    await Promise.allSettled([server.close(), transport.close()]);
  }
}

async function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  server.close();
  await once(server, "close");
}

export function getMcpServerStatus(): McpServerState {
  activeServer = getGlobalServerState();
  if (!activeServer) {
    return { available: false, port: MCP_DEFAULT_PORT };
  }

  return { available: true, port: activeServer.port };
}

export async function startMcpServer(
  port = MCP_DEFAULT_PORT,
): Promise<InProcessMcpServerHandle> {
  activeServer = getGlobalServerState();
  if (activeServer) {
    return {
      available: true,
      port: activeServer.port,
      close: activeServer.close,
    };
  }

  const server = createServer((req, res) => {
    void handleMcpRequest(req, res, port).catch((error) => {
      console.error("Game Theory Analyzer MCP request failed:", error);
      if (!res.headersSent) {
        writeJson(res, 500, {
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal error" },
          id: null,
        });
      } else {
        res.end();
      }
    });
  });

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, MCP_HTTP_HOST, () => {
        server.off("error", reject);
        resolve();
      });
    });
  } catch (error) {
    console.error("Game Theory Analyzer MCP server failed to bind:", error);
    return {
      available: false,
      port,
      close: async () => {},
    };
  }

  const close = async () => {
    if (!activeServer || activeServer.server !== server) {
      return;
    }
    setGlobalServerState(null);
    await closeServer(server);
  };

  setGlobalServerState({ close, port, server });

  console.error(
    `Game Theory Analyzer MCP server listening on http://${MCP_HTTP_HOST}:${port}/mcp`,
  );

  return { available: true, port, close };
}
