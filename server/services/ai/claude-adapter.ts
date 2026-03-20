// Claude adapter — the ONLY file that imports from @anthropic-ai/claude-agent-sdk.
// Provides two profiles: streamChat (interactive) and runAnalysisPhase (structured).

import type { ChatEvent } from "../../../shared/types/events";
import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import {
  getEntity,
  queryEntities,
  queryRelationships,
  requestLoopback,
} from "../analysis-tools";
import {
  ANALYSIS_TOOL_NAMES,
  CHAT_TOOL_NAMES,
} from "./tool-surfaces";
import { serverLog } from "../../utils/ai-logger";
import {
  handleStartAnalysis,
  handleGetAnalysisStatus,
  handleCreateEntity,
  handleUpdateEntity,
  handleDeleteEntity,
  handleCreateRelationship,
  handleDeleteRelationship,
  handleRerunPhases,
  handleAbortAnalysis,
} from "@/mcp/server";

// ── Types ──

export interface StreamChatOptions {
  runId?: string;
  /** Wall-clock timeout per chat turn in ms (default: 5 min) */
  timeoutMs?: number;
  /** Abort signal — when aborted, closes the SDK query and ends the stream */
  signal?: AbortSignal;
}

export interface AnalysisRunOptions {
  runId?: string;
  maxTurns?: number;
  signal?: AbortSignal;
}

// Re-export McpSdkServerConfigWithInstance so callers don't import the SDK directly
export type { McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";

// ── Product MCP server ──

/**
 * Build an in-process MCP server exposing the chat-mode product tools.
 * Uses createSdkMcpServer() + tool() from the Agent SDK.
 */
export async function createChatMcpServer() {
  const { createSdkMcpServer, tool } =
    await import("@anthropic-ai/claude-agent-sdk");
  const { z } = await import("zod/v4");

  const tools = [
    tool(
      "get_entity",
      "Get a single analysis entity by ID",
      { id: z.string() },
      async (args) => ({
        content: [
          { type: "text" as const, text: JSON.stringify(getEntity(args.id)) },
        ],
      }),
    ),
    tool(
      "query_entities",
      "Query analysis entities by phase, type, or stale status",
      {
        phase: z.string().optional(),
        type: z.string().optional(),
        stale: z.boolean().optional(),
      },
      async (args) => ({
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(queryEntities(args)),
          },
        ],
      }),
    ),
    tool(
      "query_relationships",
      "Query analysis relationships by entity or type",
      {
        type: z.string().optional(),
        entityId: z.string().optional(),
      },
      async (args) => ({
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(queryRelationships(args)),
          },
        ],
      }),
    ),
    tool(
      "request_loopback",
      "Record a disruption trigger for later loopback handling",
      {
        trigger_type: z.string(),
        justification: z.string(),
      },
      async (args) => ({
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(requestLoopback(args)),
          },
        ],
      }),
    ),
    tool(
      "start_analysis",
      "Start a new game-theoretic analysis",
      { topic: z.string() },
      async (args) => ({
        content: [
          { type: "text" as const, text: await handleStartAnalysis(args) },
        ],
      }),
    ),
    tool(
      "get_analysis_status",
      "Get analysis run status",
      {},
      async () => ({
        content: [
          { type: "text" as const, text: handleGetAnalysisStatus() },
        ],
      }),
    ),
    tool(
      "create_entity",
      "Create a new analysis entity",
      {
        type: z.string(),
        phase: z.string(),
        data: z.record(z.string(), z.unknown()),
        confidence: z.string().optional(),
        rationale: z.string().optional(),
        revision: z.number().optional(),
      },
      async (args) => ({
        content: [
          { type: "text" as const, text: handleCreateEntity(args as any) },
        ], // eslint-disable-line @typescript-eslint/no-explicit-any
      }),
    ),
    tool(
      "update_entity",
      "Update an existing analysis entity",
      {
        id: z.string(),
        updates: z.record(z.string(), z.unknown()),
      },
      async (args) => ({
        content: [
          { type: "text" as const, text: handleUpdateEntity(args as any) },
        ], // eslint-disable-line @typescript-eslint/no-explicit-any
      }),
    ),
    tool(
      "delete_entity",
      "Delete an analysis entity",
      { id: z.string() },
      async (args) => ({
        content: [{ type: "text" as const, text: handleDeleteEntity(args) }],
      }),
    ),
    tool(
      "create_relationship",
      "Create a relationship between entities",
      {
        type: z.string(),
        fromId: z.string(),
        toId: z.string(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      },
      async (args) => ({
        content: [
          {
            type: "text" as const,
            text: handleCreateRelationship(args as any),
          },
        ], // eslint-disable-line @typescript-eslint/no-explicit-any
      }),
    ),
    tool(
      "delete_relationship",
      "Delete a relationship",
      { id: z.string() },
      async (args) => ({
        content: [
          {
            type: "text" as const,
            text: handleDeleteRelationship(args as any),
          },
        ], // eslint-disable-line @typescript-eslint/no-explicit-any
      }),
    ),
    tool(
      "rerun_phases",
      "Rerun analysis from the earliest specified phase",
      { phases: z.array(z.string()) },
      async (args) => ({
        content: [{ type: "text" as const, text: handleRerunPhases(args) }],
      }),
    ),
    tool(
      "abort_analysis",
      "Abort the active analysis",
      {},
      async () => ({
        content: [{ type: "text" as const, text: handleAbortAnalysis() }],
      }),
    ),
  ];

  return createSdkMcpServer({
    name: "game-theory-chat",
    version: "1.0.0",
    tools,
  });
}

const ANALYSIS_MCP_SERVER_NAME = "game-theory-analysis";

export async function createAnalysisMcpServer(runId?: string) {
  const { createSdkMcpServer, tool } =
    await import("@anthropic-ai/claude-agent-sdk");
  const { z } = await import("zod/v4");

  return createSdkMcpServer({
    name: ANALYSIS_MCP_SERVER_NAME,
    version: "1.0.0",
    tools: [
      tool(
        "get_entity",
        "Get a single analysis entity by ID",
        { id: z.string() },
        async (args) => ({
          content: [
            { type: "text" as const, text: JSON.stringify(getEntity(args.id)) },
          ],
        }),
      ),
      tool(
        "query_entities",
        "Query analysis entities by phase, type, or stale status",
        {
          phase: z.string().optional(),
          type: z.string().optional(),
          stale: z.boolean().optional(),
        },
        async (args) => ({
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(queryEntities(args)),
            },
          ],
        }),
      ),
      tool(
        "query_relationships",
        "Query analysis relationships by entity or type",
        {
          type: z.string().optional(),
          entityId: z.string().optional(),
        },
        async (args) => ({
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(queryRelationships(args)),
            },
          ],
        }),
      ),
      tool(
        "request_loopback",
        "Record a disruption trigger for later loopback handling",
        {
          trigger_type: z.string(),
          justification: z.string(),
        },
        async (args) => ({
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(requestLoopback(args, runId)),
            },
          ],
        }),
      ),
    ],
  });
}

/** Exported for tests */
export const CHAT_MCP_SERVER_NAME = "game-theory-chat";
export const CHAT_MODE_TOOL_NAMES = CHAT_TOOL_NAMES;
export { ANALYSIS_MCP_SERVER_NAME, ANALYSIS_TOOL_NAMES };

// ── Chat profile ──

const CHAT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Stream a chat turn using the Claude Agent SDK.
 * Yields normalized ChatEvent objects.
 *
 * Note on single-prompt limitation: The Claude Agent SDK `query()` accepts a
 * single `prompt` string, not a multi-turn message array. The caller (chat.ts)
 * extracts only the last user message. This means multi-turn conversation
 * history is not forwarded to the SDK — this is a known limitation of the
 * Agent SDK interface, not a bug. Context is provided via the systemPrompt.
 *
 * Chat profile:
 * - permissionMode: "bypassPermissions"
 * - maxTurns: 25
 * - tools: ['WebSearch']
 * - allowedTools: chat MCP tools + WebSearch
 * - mcpServers: { chat: createChatMcpServer() }
 * - includePartialMessages: true
 * - settingSources: []
 */
export async function* streamChat(
  prompt: string,
  systemPrompt: string,
  model: string,
  options?: StreamChatOptions,
): AsyncGenerator<ChatEvent> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const { buildClaudeAgentEnv, getClaudeAgentDebugFilePath } =
    await import("../../utils/resolve-claude-agent-env");
  const { resolveClaudeCli } = await import("../../utils/resolve-claude-cli");

  const env = buildClaudeAgentEnv();
  const debugFile = getClaudeAgentDebugFilePath();
  const claudePath = resolveClaudeCli();
  const timeoutMs = options?.timeoutMs ?? CHAT_TIMEOUT_MS;

  const chatMcp = await createChatMcpServer();
  const allowedTools = [
    ...CHAT_TOOL_NAMES.map(
      (toolName) => `mcp__${CHAT_MCP_SERVER_NAME}__${toolName}`,
    ),
    "WebSearch",
  ];

  const q = query({
    prompt,
    options: {
      systemPrompt,
      model,
      maxTurns: 25,
      tools: ["WebSearch"],
      allowedTools,
      mcpServers: { chat: chatMcp },
      includePartialMessages: true,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      persistSession: false,
      settingSources: [],
      plugins: [],
      env,
      ...(debugFile ? { debugFile } : {}),
      ...(claudePath ? { pathToClaudeCodeExecutable: claudePath } : {}),
    },
  });

  // Wall-clock timeout — sets a flag and tears down the SDK session.
  // The for-await loop will exit, and we yield an error instead of turn_complete.
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    q.close();
  }, timeoutMs);

  // Abort signal — when the client disconnects, close the SDK query
  let aborted = false;
  const signal = options?.signal;
  const onAbort = () => {
    aborted = true;
    q.close();
  };
  if (signal) {
    if (signal.aborted) {
      aborted = true;
      q.close();
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  }

  let lastAssistantText = "";
  let gotResult = false;

  try {
    for await (const message of q) {
      if (message.type === "stream_event") {
        const ev = message.event;
        if (ev.type === "content_block_delta") {
          if (ev.delta.type === "text_delta") {
            yield { type: "text_delta", content: ev.delta.text };
          }
          // thinking deltas are silently consumed (not part of ChatEvent schema)
        } else if (ev.type === "content_block_start") {
          // Detect tool_use block start
          if (
            "content_block" in ev &&
            (ev.content_block as any)?.type === "tool_use"
          ) {
            const block = ev.content_block as any;
            yield {
              type: "tool_call_start",
              toolName: block.name ?? "unknown",
              input: block.input ?? {},
            };
          }
        }
      } else if (message.type === "assistant") {
        // Track last assistant text for fallback
        const content =
          (message as any).message?.content ?? (message as any).content;
        if (Array.isArray(content)) {
          // Extract tool results from content blocks
          for (const block of content) {
            if (block.type === "tool_use") {
              // tool_use blocks in assistant message indicate tool invocation;
              // the result comes from tool_result blocks in subsequent user messages,
              // but the SDK doesn't expose those directly. We emit start here if
              // we didn't already from stream_event.
            } else if (block.type === "tool_result") {
              yield {
                type: "tool_call_result",
                toolName: (block as any).tool_name ?? "unknown",
                output: (block as any).content ?? block,
              };
            }
          }
          const text = content
            .filter((b: any) => b.type === "text")
            .map((b: any) => b.text)
            .join("");
          if (text) lastAssistantText = text;
        }
      } else if (message.type === "result") {
        gotResult = true;
        const isError =
          "is_error" in message && Boolean((message as any).is_error);
        if (message.subtype === "success" && !isError) {
          yield { type: "turn_complete" };
        } else {
          const errors =
            "errors" in message ? ((message as any).errors as string[]) : [];
          const resultText =
            "result" in message ? String((message as any).result ?? "") : "";
          const msg =
            errors.join("; ") ||
            resultText ||
            `Query ended with: ${message.subtype}`;
          yield { type: "error", message: msg, recoverable: false };
        }
      }
    }

    // If aborted (client disconnected), exit silently — no error needed
    if (aborted) {
      return;
    }

    // If timeout fired, yield error and do NOT fall through to turn_complete
    if (timedOut) {
      yield {
        type: "error",
        message: "Chat turn timed out after 5 minutes",
        recoverable: false,
      };
      return;
    }

    // Fallback: SDK yielded assistant text but never a result event
    if (!gotResult && lastAssistantText) {
      yield { type: "text_delta", content: lastAssistantText };
      yield { type: "turn_complete" };
    } else if (!gotResult) {
      yield { type: "turn_complete" };
    }
  } catch (err) {
    // Suppress errors caused by abort (client disconnect)
    if (aborted) return;
    const msg = err instanceof Error ? err.message : String(err);
    yield { type: "error", message: msg, recoverable: false };
  } finally {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener("abort", onAbort);
    q.close();
  }
}

// ── Analysis profile ──

const ANALYSIS_MAX_TURNS = 12;

function createStreamingPrompt(prompt: string): AsyncIterable<SDKUserMessage> {
  return (async function* (): AsyncGenerator<SDKUserMessage> {
    yield {
      type: "user" as const,
      message: {
        role: "user" as const,
        content: prompt,
      },
      parent_tool_use_id: null,
      session_id: "analysis-phase",
    };
  })();
}

/**
 * Run a single analysis phase using Claude with structured JSON output.
 * Returns the parsed JSON result.
 *
 * Analysis profile:
 * - permissionMode: "dontAsk"
 * - maxTurns: 12 (configurable)
 * - allowedTools: read-only MCP tools + WebSearch
 * - mcpServers: { analysis: createAnalysisMcpServer() }
 * - includePartialMessages: true
 * - outputFormat: { type: 'json_schema', schema }
 * - settingSources: []
 */
export async function runAnalysisPhase<T = unknown>(
  prompt: string,
  systemPrompt: string,
  model: string,
  schema: Record<string, unknown>,
  options?: AnalysisRunOptions,
): Promise<T> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const { buildClaudeAgentEnv, getClaudeAgentDebugFilePath } =
    await import("../../utils/resolve-claude-agent-env");
  const { resolveClaudeCli } = await import("../../utils/resolve-claude-cli");

  const env = buildClaudeAgentEnv();
  const debugFile = getClaudeAgentDebugFilePath();
  const claudePath = resolveClaudeCli();
  const readOnlyMcp = await createAnalysisMcpServer(options?.runId);
  const allowedTools = [
    ...ANALYSIS_TOOL_NAMES.map(
      (toolName) => `mcp__${ANALYSIS_MCP_SERVER_NAME}__${toolName}`,
    ),
    "WebSearch",
  ];

  const q = query({
    prompt: createStreamingPrompt(prompt),
    options: {
      systemPrompt,
      model,
      maxTurns: options?.maxTurns ?? ANALYSIS_MAX_TURNS,
      allowedTools,
      mcpServers: { analysis: readOnlyMcp },
      includePartialMessages: true,
      permissionMode: "dontAsk",
      persistSession: false,
      settingSources: [],
      plugins: [],
      outputFormat: { type: "json_schema", schema },
      env,
      ...(debugFile ? { debugFile } : {}),
      ...(claudePath ? { pathToClaudeCodeExecutable: claudePath } : {}),
    },
  });

  // Close query on abort signal
  if (options?.signal) {
    const onAbort = () => q.close();
    options.signal.addEventListener("abort", onAbort, { once: true });
    // Clean up listener when we're done (in finally)
    const cleanup = () =>
      options.signal?.removeEventListener("abort", onAbort);
    try {
      return await _runAnalysisQuery<T>(q, options);
    } finally {
      cleanup();
    }
  }

  return _runAnalysisQuery<T>(q, options);
}

/** Internal: consume the query iterator and extract the result. */
async function _runAnalysisQuery<T>(
  q: { close: () => void } & AsyncIterable<any>,
  options?: AnalysisRunOptions,
): Promise<T> {
  try {
    for await (const message of q) {
      if (options?.signal?.aborted) {
        throw new Error("Aborted");
      }
      if (message.type === "stream_event") {
        const ev = message.event;
        if (
          ev?.type === "content_block_start" &&
          (ev.content_block as any)?.type === "tool_use"
        ) {
          const toolName = (ev.content_block as any)?.name ?? "unknown";
          serverLog(options?.runId, "claude-adapter", "analysis-tool-call", {
            toolName,
          });
        }
      }
      if (message.type === "result") {
        const isError =
          "is_error" in message && Boolean((message as any).is_error);
        if (message.subtype === "success" && !isError) {
          // Prefer structured_output; fall back to parsing result text
          const structured = (message as any).structured_output;
          if (structured !== undefined) return structured as T;
          const text = (message as any).result;
          if (text) return JSON.parse(text) as T;
          throw new Error("Analysis phase returned empty result");
        }
        const errors =
          "errors" in message ? ((message as any).errors as string[]) : [];
        const resultText =
          "result" in message ? String((message as any).result ?? "") : "";
        throw new Error(
          errors.join("; ") ||
            resultText ||
            `Analysis ended with: ${message.subtype}`,
        );
      }
    }
    if (options?.signal?.aborted) {
      throw new Error("Aborted");
    }
    throw new Error("Analysis phase completed without result");
  } finally {
    q.close();
  }
}
