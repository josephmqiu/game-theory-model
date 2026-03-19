// Claude adapter — the ONLY file that imports from @anthropic-ai/claude-agent-sdk.
// Provides two profiles: streamChat (interactive) and runAnalysisPhase (structured).

import type { ChatEvent } from "./chat-events";
import {
  handleStartAnalysis,
  handleGetAnalysisStatus,
  handleGetAnalysisResult,
  handleRevalidateEntities,
  handleGetEntities,
  handleCreateEntity,
  handleUpdateEntity,
  handleGetRelationships,
  handleCreateRelationship,
  handleUpdateRelationship,
  handleLayoutEntities,
  handleFocusEntity,
  handleGroupEntities,
} from "@/mcp/server";

// ── Types ──

export interface StreamChatOptions {
  runId?: string;
  /** Wall-clock timeout per chat turn in ms (default: 5 min) */
  timeoutMs?: number;
}

// Re-export McpSdkServerConfigWithInstance so callers don't import the SDK directly
export type { McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";

// ── Product tool names (13) ──

const PRODUCT_TOOL_NAMES = [
  "start_analysis",
  "get_analysis_status",
  "get_analysis_result",
  "revalidate_entities",
  "get_entities",
  "create_entity",
  "update_entity",
  "get_relationships",
  "create_relationship",
  "update_relationship",
  "layout_entities",
  "focus_entity",
  "group_entities",
] as const;

// ── Product MCP server ──

/**
 * Build an in-process MCP server exposing ONLY the 13 product tools.
 * Uses createSdkMcpServer() + tool() from the Agent SDK.
 */
export async function createProductMcpServer() {
  const { createSdkMcpServer, tool } =
    await import("@anthropic-ai/claude-agent-sdk");
  const { z } = await import("zod/v4");

  const tools = [
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
      { runId: z.string() },
      async (args) => ({
        content: [
          { type: "text" as const, text: handleGetAnalysisStatus(args) },
        ],
      }),
    ),
    tool(
      "get_analysis_result",
      "Get completed analysis result",
      { runId: z.string() },
      async (args) => ({
        content: [
          { type: "text" as const, text: handleGetAnalysisResult(args) },
        ],
      }),
    ),
    tool(
      "revalidate_entities",
      "Revalidate stale entities",
      {
        entityIds: z.array(z.string()).optional(),
        phase: z.string().optional(),
      },
      async (args) => ({
        content: [
          {
            type: "text" as const,
            text: handleRevalidateEntities(args),
          },
        ],
      }),
    ),
    tool(
      "get_entities",
      "Get analysis entities",
      {
        phase: z.string().optional(),
        type: z.string().optional(),
        filters: z.record(z.string(), z.unknown()).optional(),
      },
      async (args) => ({
        content: [{ type: "text" as const, text: handleGetEntities(args) }],
      }),
    ),
    tool(
      "create_entity",
      "Create a new analysis entity",
      {
        type: z.string(),
        phase: z.string(),
        data: z.record(z.string(), z.unknown()),
        position: z.object({ x: z.number(), y: z.number() }).optional(),
        confidence: z.string().optional(),
        source: z.string().optional(),
        rationale: z.string().optional(),
        revision: z.number().optional(),
        runId: z.string().optional(),
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
        type: z.string().optional(),
        phase: z.string().optional(),
        data: z.record(z.string(), z.unknown()).optional(),
        position: z.object({ x: z.number(), y: z.number() }).optional(),
        confidence: z.string().optional(),
        source: z.string().optional(),
        rationale: z.string().optional(),
        revision: z.number().optional(),
        runId: z.string().optional(),
      },
      async (args) => ({
        content: [
          { type: "text" as const, text: handleUpdateEntity(args as any) },
        ], // eslint-disable-line @typescript-eslint/no-explicit-any
      }),
    ),
    tool(
      "get_relationships",
      "Get analysis relationships",
      { type: z.string().optional(), entityId: z.string().optional() },
      async (args) => ({
        content: [
          { type: "text" as const, text: handleGetRelationships(args) },
        ],
      }),
    ),
    tool(
      "create_relationship",
      "Create a relationship between entities",
      {
        type: z.string(),
        from: z.string(),
        to: z.string(),
        meta: z.record(z.string(), z.unknown()).optional(),
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
      "update_relationship",
      "Update a relationship",
      {
        id: z.string(),
        type: z.string().optional(),
        meta: z.record(z.string(), z.unknown()).optional(),
      },
      async (args) => ({
        content: [
          {
            type: "text" as const,
            text: handleUpdateRelationship(args as any),
          },
        ], // eslint-disable-line @typescript-eslint/no-explicit-any
      }),
    ),
    tool(
      "layout_entities",
      "Apply layout strategy to entities",
      { strategy: z.string() },
      async (args) => ({
        content: [{ type: "text" as const, text: handleLayoutEntities(args) }],
      }),
    ),
    tool(
      "focus_entity",
      "Focus canvas on an entity",
      { entityId: z.string() },
      async (args) => ({
        content: [{ type: "text" as const, text: handleFocusEntity(args) }],
      }),
    ),
    tool(
      "group_entities",
      "Group entities visually",
      { entityIds: z.array(z.string()), label: z.string() },
      async (args) => ({
        content: [{ type: "text" as const, text: handleGroupEntities(args) }],
      }),
    ),
  ];

  return createSdkMcpServer({
    name: "game-theory-product",
    version: "1.0.0",
    tools,
  });
}

/** Exported for tests */
export { PRODUCT_TOOL_NAMES };

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
 * - mcpServers: { product: createProductMcpServer() }
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
    await import("../../../server/utils/resolve-claude-agent-env");
  const { resolveClaudeCli } =
    await import("../../../server/utils/resolve-claude-cli");

  const env = buildClaudeAgentEnv();
  const debugFile = getClaudeAgentDebugFilePath();
  const claudePath = resolveClaudeCli();
  const timeoutMs = options?.timeoutMs ?? CHAT_TIMEOUT_MS;

  const productMcp = await createProductMcpServer();

  const q = query({
    prompt,
    options: {
      systemPrompt,
      model,
      maxTurns: 25,
      tools: ["WebSearch"],
      mcpServers: { product: productMcp },
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
    const msg = err instanceof Error ? err.message : String(err);
    yield { type: "error", message: msg, recoverable: false };
  } finally {
    clearTimeout(timeoutId);
    q.close();
  }
}

// ── Analysis profile ──

/**
 * Run a single analysis phase using Claude with structured JSON output.
 * Returns the parsed JSON result.
 *
 * Analysis profile:
 * - permissionMode: "bypassPermissions"
 * - maxTurns: 1
 * - tools: ['WebSearch']
 * - NO mcpServers
 * - includePartialMessages: false
 * - outputFormat: { type: 'json_schema', schema }
 * - settingSources: []
 */
export async function runAnalysisPhase<T = unknown>(
  prompt: string,
  systemPrompt: string,
  model: string,
  schema: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const { buildClaudeAgentEnv, getClaudeAgentDebugFilePath } =
    await import("../../../server/utils/resolve-claude-agent-env");
  const { resolveClaudeCli } =
    await import("../../../server/utils/resolve-claude-cli");

  const env = buildClaudeAgentEnv();
  const debugFile = getClaudeAgentDebugFilePath();
  const claudePath = resolveClaudeCli();

  const q = query({
    prompt,
    options: {
      systemPrompt,
      model,
      maxTurns: 1,
      tools: ["WebSearch"],
      includePartialMessages: false,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
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
  if (signal) {
    const onAbort = () => q.close();
    signal.addEventListener("abort", onAbort, { once: true });
    // Clean up listener when we're done (in finally)
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    try {
      return await _runAnalysisQuery<T>(q, signal);
    } finally {
      cleanup();
    }
  }

  return _runAnalysisQuery<T>(q);
}

/** Internal: consume the query iterator and extract the result. */
async function _runAnalysisQuery<T>(
  q: { close: () => void } & AsyncIterable<any>,
  signal?: AbortSignal,
): Promise<T> {
  try {
    for await (const message of q) {
      if (signal?.aborted) {
        throw new Error("Aborted");
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
    if (signal?.aborted) {
      throw new Error("Aborted");
    }
    throw new Error("Analysis phase completed without result");
  } finally {
    q.close();
  }
}
