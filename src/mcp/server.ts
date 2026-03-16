#!/usr/bin/env node

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { registerPhaseTools } from "shared/game-theory/mcp-tools/phases";
import { registerModelTools } from "shared/game-theory/mcp-tools/model";
import { registerPlayTools } from "shared/game-theory/mcp-tools/play";
import type {
  McpServerLike,
  RuntimeToolContext,
} from "shared/game-theory/mcp-tools/context";

const MCP_DEFAULT_PORT = 3100;
const SERVER_NAME = "game-theory-analyzer";
const SERVER_VERSION = "0.1.0";

// --- Tool registry bridge ---
// Converts between the shared McpServerLike interface and the MCP SDK Server

interface ToolEntry {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => unknown;
}

function createToolRegistry(): {
  bridge: McpServerLike;
  tools: ToolEntry[];
} {
  const tools: ToolEntry[] = [];

  const bridge: McpServerLike = {
    registerTool(definition) {
      tools.push({
        name: definition.name,
        description: definition.description,
        inputSchema: {
          type: "object" as const,
          properties: {},
        },
        execute: definition.execute as (
          input: Record<string, unknown>,
        ) => unknown,
      });
    },
  };

  return { bridge, tools };
}

// --- Server setup ---

function registerTools(
  server: Server,
  context: RuntimeToolContext,
): ToolEntry[] {
  const { bridge, tools } = createToolRegistry();

  registerPhaseTools(bridge, context);
  registerModelTools(bridge, context);
  registerPlayTools(bridge);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = tools.find((t) => t.name === name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Error: Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      const result = await tool.execute(args ?? {});
      const text =
        typeof result === "string" ? result : JSON.stringify(result, null, 2);
      return { content: [{ type: "text", text }] };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  });

  return tools;
}

// --- HTTP server ---

function startHttpServer(port: number, context: RuntimeToolContext): void {
  const sessions = new Map<
    string,
    { transport: StreamableHTTPServerTransport; server: Server }
  >();

  const httpServer = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, mcp-session-id",
    );
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url !== "/mcp") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found. Use /mcp endpoint." }));
      return;
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    // Route to existing session
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      if (req.method === "POST") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString());
        await session.transport.handleRequest(req, res, body);
      } else {
        await session.transport.handleRequest(req, res);
      }
      return;
    }

    // New session -- only POST (initialize) is valid without session ID
    if (req.method === "POST") {
      const mcpServer = new Server(
        { name: SERVER_NAME, version: SERVER_VERSION },
        { capabilities: { tools: {} } },
      );
      registerTools(mcpServer, context);

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid: string) => {
          sessions.set(sid, { transport, server: mcpServer });
        },
        onsessionclosed: (sid: string) => {
          sessions.delete(sid);
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
      };

      await mcpServer.connect(transport);

      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body = JSON.parse(Buffer.concat(chunks).toString());
      await transport.handleRequest(req, res, body);
      return;
    }

    // Invalid: GET/DELETE without valid session ID
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Invalid or missing session ID" },
        id: null,
      }),
    );
  });

  httpServer.listen(port, "0.0.0.0", () => {
    console.error(
      `Game Theory MCP server listening on http://0.0.0.0:${port}/mcp`,
    );
  });
}

// --- CLI args ---

function parseArgs(): { stdio: boolean; http: boolean; port: number } {
  const args = process.argv.slice(2);
  const hasHttp = args.includes("--http");
  const hasStdio = args.includes("--stdio");
  const portIdx = args.indexOf("--port");
  const port =
    portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : MCP_DEFAULT_PORT;

  if (hasHttp && hasStdio)
    return {
      stdio: true,
      http: true,
      port: isNaN(port) ? MCP_DEFAULT_PORT : port,
    };
  if (hasHttp)
    return {
      stdio: false,
      http: true,
      port: isNaN(port) ? MCP_DEFAULT_PORT : port,
    };
  return { stdio: true, http: false, port: MCP_DEFAULT_PORT };
}

// --- Stub context (will be replaced with real PipelineHost integration) ---

function createStubContext(): RuntimeToolContext {
  // Minimal stub that satisfies the RuntimeToolContext interface.
  // Real implementation will be wired when PipelineHost is available at runtime.
  const emptyStore = {} as RuntimeToolContext["host"];
  const emptyOrchestrator = {
    startAnalysis: async () => {},
    runPhase: async () => {},
    approveRevalidation: async () => null,
    dismissRevalidation: () => {},
    getPendingRevalidations: () => [],
  } as unknown as RuntimeToolContext["orchestrator"];

  return {
    host: emptyStore,
    server: { registerTool: () => {} },
    orchestrator: emptyOrchestrator,
    getModel: () => null,
    getCanonicalStore: () =>
      ({}) as ReturnType<RuntimeToolContext["getCanonicalStore"]>,
    getAllPhaseStatuses: () => [],
    getEntities: () => [],
    getPersistedRevision: () => 0,
    getPipelineState: () =>
      ({
        analysis_state: null,
        phase_results: {},
      }) as ReturnType<RuntimeToolContext["getPipelineState"]>,
    getPipelineRuntimeState: () =>
      ({
        active_rerun_cycle: null,
      }) as ReturnType<RuntimeToolContext["getPipelineRuntimeState"]>,
  };
}

// --- Start ---

async function main() {
  const { stdio, http, port } = parseArgs();
  const context = createStubContext();

  if (stdio && http) {
    const stdioServer = new Server(
      { name: SERVER_NAME, version: SERVER_VERSION },
      { capabilities: { tools: {} } },
    );
    registerTools(stdioServer, context);
    await stdioServer.connect(new StdioServerTransport());
    startHttpServer(port, context);
  } else if (http) {
    startHttpServer(port, context);
  } else {
    const server = new Server(
      { name: SERVER_NAME, version: SERVER_VERSION },
      { capabilities: { tools: {} } },
    );
    registerTools(server, context);
    await server.connect(new StdioServerTransport());
  }
}

// Prevent uncaught errors from crashing the MCP server process
process.on("uncaughtException", (err) => {
  console.error("MCP server uncaught exception:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("MCP server unhandled rejection:", err);
});

main().catch((err) => {
  console.error("MCP server failed to start:", err);
  process.exit(1);
});
