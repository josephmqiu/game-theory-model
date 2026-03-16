#!/usr/bin/env node

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
import { emptyCanonicalStore } from "shared/game-theory/types/canonical";

const MCP_DEFAULT_PORT = 3100;
const SERVER_NAME = "game-theory-analyzer";
const SERVER_VERSION = "0.1.0";

// --- Tool registry bridge ---

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

// --- Nitro cache reader ---

function readNitroPort(): number | null {
  try {
    const portFile = join(
      process.env.HOME ?? "",
      ".game-theory-analyzer",
      ".port",
    );
    const port = parseInt(readFileSync(portFile, "utf-8").trim(), 10);
    return isNaN(port) ? null : port;
  } catch {
    return null;
  }
}

async function fetchSyncState(nitroPort: number): Promise<{
  canonical: ReturnType<RuntimeToolContext["getCanonicalStore"]>;
  pipelineState: ReturnType<RuntimeToolContext["getPipelineState"]>;
  runtimeState: ReturnType<RuntimeToolContext["getPipelineRuntimeState"]>;
}> {
  try {
    const res = await fetch(`http://127.0.0.1:${nitroPort}/api/mcp/state`);
    const data = (await res.json()) as {
      status: string;
      state?: {
        canonical: ReturnType<RuntimeToolContext["getCanonicalStore"]>;
        pipelineState: ReturnType<RuntimeToolContext["getPipelineState"]>;
        runtimeState: ReturnType<RuntimeToolContext["getPipelineRuntimeState"]>;
      };
    };
    if (data.status === "ok" && data.state) {
      return {
        canonical: data.state.canonical,
        pipelineState: data.state.pipelineState,
        runtimeState: data.state.runtimeState,
      };
    }
  } catch {
    // Nitro not running or unreachable
  }
  return {
    canonical: emptyCanonicalStore(),
    pipelineState: { analysis_state: null, phase_results: {} },
    runtimeState: {
      prompt_registry: {
        versions: {},
        active_versions: {},
        official_versions: {},
      },
      active_rerun_cycle: null,
      pending_revalidation_approvals: {},
    },
  };
}

// --- Context from Nitro cache ---

function createNitroBackedContext(nitroPort: number): RuntimeToolContext {
  // Cache state, refresh on each tool call
  let cachedState: Awaited<ReturnType<typeof fetchSyncState>> | null = null;

  async function refreshState() {
    cachedState = await fetchSyncState(nitroPort);
    return cachedState;
  }

  // Eagerly fetch on startup
  refreshState();

  const emptyStore = emptyCanonicalStore();

  const host = {
    getCanonical: () => cachedState?.canonical ?? emptyStore,
    getAnalysisFile: () => null,
    getPersistedRevision: () => 0,
    getActiveAnalysisId: () =>
      (cachedState?.pipelineState?.analysis_state as { id?: string })?.id ?? "",
    resetAnalysisSession: () => {},
    dispatch: () => ({
      status: "rejected" as const,
      reason: "error" as const,
      errors: [
        "MCP cannot dispatch directly. Use the renderer's command spine.",
      ],
    }),
    emitConversationMessage: () => {},
    getPipelineState: () =>
      cachedState?.pipelineState ?? {
        analysis_state: null,
        phase_results: {},
      },
    startPipelineAnalysis: () => {
      throw new Error("MCP cannot start pipeline analysis directly.");
    },
    updateAnalysisState: () => {},
    setPhaseResult: () => {},
    upsertPhaseExecution: () => {},
    setPipelineProposalReview: () => {},
    addSteeringMessage: () => {},
    getPipelineRuntimeState: () =>
      cachedState?.runtimeState ?? {
        prompt_registry: {
          versions: {},
          active_versions: {},
          official_versions: {},
        },
        active_rerun_cycle: null,
        pending_revalidation_approvals: {},
      },
    registerPendingRevalidationApproval: () => {},
    clearPendingRevalidationApproval: () => {},
    setActiveRerunCycle: () => {},
    updatePromptRegistry: () => {},
    getConversationState: () => ({
      proposal_review: {
        proposals: [],
        active_proposal_index: 0,
        merge_log: [],
      },
    }),
    registerProposalGroup: () => {},
    getFirstPendingProposalPhase: () => null,
    updateRevalidationActionStatus: () => {},
    getDerivedState: () => ({ sensitivityByFormalizationAndSolver: {} }),
  } as unknown as RuntimeToolContext["host"];

  const orchestrator = {
    startAnalysis: async () => {
      await refreshState();
    },
    runPhase: async () => {
      await refreshState();
    },
    approveRevalidation: async () => null,
    dismissRevalidation: () => {},
    getPendingRevalidations: () => [],
  } as unknown as RuntimeToolContext["orchestrator"];

  return {
    host,
    server: { registerTool: () => {} },
    orchestrator,
    getModel: () => null,
    getCanonicalStore: () => cachedState?.canonical ?? emptyStore,
    getAllPhaseStatuses: () => [],
    getEntities: () => [],
    getPersistedRevision: () => 0,
    getPipelineState: () =>
      cachedState?.pipelineState ?? {
        analysis_state: null,
        phase_results: {},
      },
    getPipelineRuntimeState: () =>
      cachedState?.runtimeState ?? {
        prompt_registry: {
          versions: {},
          active_versions: {},
          official_versions: {},
        },
        active_rerun_cycle: null,
        pending_revalidation_approvals: {},
      },
  };
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
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
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

    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      if (req.method === "POST") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        let body: unknown;
        try {
          body = JSON.parse(Buffer.concat(chunks).toString());
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Malformed JSON in request body" }));
          return;
        }
        await session.transport.handleRequest(req, res, body);
      } else {
        await session.transport.handleRequest(req, res);
      }
      return;
    }

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
      let body: unknown;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString());
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Malformed JSON in request body" }));
        return;
      }
      await transport.handleRequest(req, res, body);
      return;
    }

    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Invalid or missing session ID" },
        id: null,
      }),
    );
  });

  httpServer.listen(port, "127.0.0.1", () => {
    console.error(
      `Game Theory MCP server listening on http://127.0.0.1:${port}/mcp`,
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

// --- Start ---

async function main() {
  const { stdio, http, port } = parseArgs();

  // Try to connect to Nitro's synced cache
  const nitroPort = readNitroPort();
  const context = nitroPort
    ? createNitroBackedContext(nitroPort)
    : createNitroBackedContext(3000); // Default dev port

  if (nitroPort) {
    console.error(`MCP server reading state from Nitro on port ${nitroPort}`);
  } else {
    console.error(`No .port file found, using default Nitro port 3000`);
  }

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

process.on("uncaughtException", (err) => {
  console.error("MCP server uncaught exception:", err);
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  console.error("MCP server unhandled rejection:", err);
});

main().catch((err) => {
  console.error("MCP server failed to start:", err);
  process.exit(1);
});
