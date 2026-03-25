// Claude adapter — the ONLY file that imports from @anthropic-ai/claude-agent-sdk.
// Provides two profiles: streamChat (interactive) and runAnalysisPhase (structured).

import type { ChatEvent } from "../../../shared/types/events";
import type {
  RuntimeAdapter,
  RuntimeAdapterSession,
  RuntimeAdapterSessionKey,
  RuntimeChatTurnInput,
  RuntimeSessionDiagnostics,
  RuntimeStructuredTurnInput,
} from "./adapter-contract";
import { mapRuntimeModels } from "./adapter-contract";
import {
  createProcessRuntimeError,
  createProviderRuntimeError,
} from "../../../shared/types/runtime-error";
import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import {
  getEntity,
  queryEntities,
  queryRelationships,
  requestLoopback,
} from "../analysis-tools";
import { ANALYSIS_TOOL_NAMES, CHAT_TOOL_NAMES } from "./tool-surfaces";
import { serverError, serverLog, serverWarn } from "../../utils/ai-logger";
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
} from "../../mcp/product-tools";
import { analysisRuntimeConfig } from "../../config/analysis-runtime";
import type { AnalysisActivityCallback } from "./analysis-activity";
import { getClaudeProviderSnapshot } from "./provider-health";

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
  webSearch?: boolean;
  onActivity?: AnalysisActivityCallback;
}

type ClaudeAnalysisMode = "structured" | "json-fallback";

interface ClaudeSessionState {
  sessionId: string;
  key: RuntimeAdapterSessionKey;
  debugFile?: string;
}

function createClaudeSessionState(
  key: RuntimeAdapterSessionKey,
): ClaudeSessionState {
  return {
    sessionId: `claude-${key.ownerId}-${Math.random().toString(36).slice(2, 10)}`,
    key,
  };
}

function isClaudeWebSearchTool(toolName: unknown): boolean {
  return toolName === "WebSearch" || toolName === "web_search";
}

function getClaudeActivityToolLabel(toolName: string): string {
  return isClaudeWebSearchTool(toolName) ? "WebSearch" : toolName;
}

function getWebSearchQueryFromToolInput(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const query = (input as Record<string, unknown>).query;
  if (typeof query !== "string") return undefined;
  const trimmed = query.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parsePartialJsonRecord(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
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
    tool("get_analysis_status", "Get analysis run status", {}, async () => ({
      content: [{ type: "text" as const, text: handleGetAnalysisStatus() }],
    })),
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
          {
            type: "text" as const,
            text: await handleCreateEntity(args as any),
          },
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
          {
            type: "text" as const,
            text: await handleUpdateEntity(args as any),
          },
        ], // eslint-disable-line @typescript-eslint/no-explicit-any
      }),
    ),
    tool(
      "delete_entity",
      "Delete an analysis entity",
      { id: z.string() },
      async (args) => ({
        content: [
          {
            type: "text" as const,
            text: await handleDeleteEntity(args),
          },
        ],
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
            text: await handleCreateRelationship(args as any),
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
            text: await handleDeleteRelationship(args as any),
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
    tool("abort_analysis", "Abort the active analysis", {}, async () => ({
      content: [
        { type: "text" as const, text: await handleAbortAnalysis() },
      ],
    })),
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

const CHAT_TIMEOUT_MS = analysisRuntimeConfig.claude.chatTimeoutMs;

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
 * - maxTurns: 99
 * - tools: ['WebSearch']
 * - allowedTools: chat MCP tools + WebSearch
 * - mcpServers: { chat: createChatMcpServer() }
 * - includePartialMessages: true
 * - settingSources: []
 */
async function* streamClaudeChatTurn(
  input: RuntimeChatTurnInput,
  session: ClaudeSessionState,
): AsyncGenerator<ChatEvent> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const { buildClaudeAgentEnv, getClaudeAgentDebugFilePath } =
    await import("../../utils/resolve-claude-agent-env");
  const { resolveClaudeCli } = await import("../../utils/resolve-claude-cli");

  const env = buildClaudeAgentEnv();
  const debugFile = getClaudeAgentDebugFilePath();
  const claudePath = resolveClaudeCli();
  const timeoutMs = input.timeoutMs ?? CHAT_TIMEOUT_MS;
  session.debugFile = debugFile ?? undefined;

  const chatMcp = await createChatMcpServer();
  const allowedTools = [
    ...CHAT_TOOL_NAMES.map(
      (toolName) => `mcp__${CHAT_MCP_SERVER_NAME}__${toolName}`,
    ),
    "WebSearch",
  ];

  const q = query({
    prompt: input.prompt,
    options: {
      systemPrompt: input.systemPrompt,
      model: input.model,
      maxTurns: 99,
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
  const signal = input.signal;
  const closeQueryOnAbort = () => {
    // Defer the close slightly so async iterators can install their pending
    // resolution hooks before we tear the query down.
    queueMicrotask(() => q.close());
  };
  const onAbort = () => {
    aborted = true;
    closeQueryOnAbort();
  };
  if (signal) {
    if (signal.aborted) {
      aborted = true;
      closeQueryOnAbort();
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
          yield {
            type: "error",
            error: createProviderRuntimeError(msg, {
              provider: "claude",
              reason: "unknown",
              retryable: false,
            }),
          };
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
        error: createProviderRuntimeError("Chat turn timed out after 5 minutes", {
            provider: "claude",
            reason: "unavailable",
            retryable: true,
        }),
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
    yield {
      type: "error",
      error: createProcessRuntimeError(msg, {
        provider: "claude",
        processState: "failed-to-start",
        retryable: false,
      }),
    };
  } finally {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener("abort", onAbort);
    q.close();
  }
}

// ── Analysis profile ──

const ANALYSIS_MAX_TURNS = analysisRuntimeConfig.claude.analysisMaxTurns;
const CLAUDE_JSON_FALLBACK_INSTRUCTION =
  "Structured output fallback mode: return JSON only with no prose, no markdown fences, and no explanations. The JSON must match the requested schema shape exactly.";

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

function supportsClaudeAnalysisHardening(model: string): boolean {
  return model === "default" || /sonnet/i.test(model);
}

function shouldAttemptClaudeJsonFallback(
  model: string,
  errorMessage: string,
): boolean {
  if (!supportsClaudeAnalysisHardening(model)) {
    return false;
  }

  if (
    /aborted|invalid api key|auth|unauthorized|forbidden|unknown model|model.*not|not found|enoent|process exited/i.test(
      errorMessage,
    )
  ) {
    return false;
  }

  return /structured output|output format|response_format|outputschema|json_schema|without a usable result|without terminal result|invalid json text|empty result/i.test(
    errorMessage,
  );
}

function buildClaudeJsonFallbackSystemPrompt(
  systemPrompt: string,
  schema: Record<string, unknown>,
): string {
  return `${systemPrompt}\n\n${CLAUDE_JSON_FALLBACK_INSTRUCTION}\nSchema:\n${JSON.stringify(schema, null, 2)}`;
}

function buildAnalysisQuery(
  query: typeof import("@anthropic-ai/claude-agent-sdk").query,
  prompt: string,
  systemPrompt: string,
  model: string,
  schema: Record<string, unknown>,
  allowedTools: string[],
  readOnlyMcp: unknown,
  env: Record<string, string | undefined>,
  mode: ClaudeAnalysisMode,
  options?: AnalysisRunOptions,
  debugFile?: string,
  claudePath?: string,
) {
  return query({
    prompt: createStreamingPrompt(prompt),
    options: {
      systemPrompt,
      model,
      maxTurns: options?.maxTurns ?? ANALYSIS_MAX_TURNS,
      allowedTools,
      mcpServers: { analysis: readOnlyMcp as any },
      includePartialMessages: true,
      permissionMode: "dontAsk",
      persistSession: false,
      settingSources: [],
      plugins: [],
      ...(mode === "structured"
        ? { outputFormat: { type: "json_schema" as const, schema } }
        : {}),
      env,
      ...(debugFile ? { debugFile } : {}),
      ...(claudePath ? { pathToClaudeCodeExecutable: claudePath } : {}),
    },
  });
}

async function runClaudeAnalysisAttempt<T>(
  q: { close: () => void } & AsyncIterable<any>,
  mode: ClaudeAnalysisMode,
  model: string,
  options?: AnalysisRunOptions,
): Promise<T | string> {
  try {
    const toolInputStates = new Map<
      number,
      { toolName: string; partialJson: string; lastQuery?: string }
    >();

    serverLog(options?.runId, "claude-adapter", "analysis-query-start", {
      mode,
      model,
    });

    for await (const message of q) {
      if (options?.signal?.aborted) {
        serverWarn(options?.runId, "claude-adapter", "analysis-query-aborted", {
          mode,
          model,
        });
        throw new Error("Aborted");
      }

      if (message.type === "stream_event") {
        const ev = message.event;
        if (
          ev?.type === "content_block_delta" &&
          ev.delta?.type === "input_json_delta" &&
          typeof ev.index === "number"
        ) {
          const toolInputState = toolInputStates.get(ev.index);
          if (
            toolInputState &&
            isClaudeWebSearchTool(toolInputState.toolName) &&
            typeof ev.delta.partial_json === "string"
          ) {
            toolInputState.partialJson += ev.delta.partial_json;
            const parsedInput = parsePartialJsonRecord(
              toolInputState.partialJson,
            );
            const query = getWebSearchQueryFromToolInput(parsedInput);
            if (query && query !== toolInputState.lastQuery) {
              toolInputState.lastQuery = query;
              options?.onActivity?.({
                kind: "web-search",
                message: "Using WebSearch",
                query,
              });
              serverLog(options?.runId, "claude-adapter", "analysis-tool-call", {
                mode,
                toolName: toolInputState.toolName,
                query,
                streamedInput: true,
              });
            }
          }
        }
        if (
          ev?.type === "content_block_start" &&
          ((ev.content_block as any)?.type === "tool_use" ||
            (ev.content_block as any)?.type === "server_tool_use")
        ) {
          const toolName = (ev.content_block as any)?.name ?? "unknown";
          const input = (ev.content_block as any)?.input;
          const query = isClaudeWebSearchTool(toolName)
            ? getWebSearchQueryFromToolInput(input)
            : undefined;
          if (typeof ev.index === "number") {
            toolInputStates.set(ev.index, {
              toolName,
              partialJson: "",
              ...(query ? { lastQuery: query } : {}),
            });
          }
          options?.onActivity?.({
            kind: isClaudeWebSearchTool(toolName) ? "web-search" : "tool",
            message: `Using ${getClaudeActivityToolLabel(toolName)}`,
            ...(isClaudeWebSearchTool(toolName)
              ? {}
              : { toolName: getClaudeActivityToolLabel(toolName) }),
            ...(query ? { query } : {}),
          });
          serverLog(options?.runId, "claude-adapter", "analysis-tool-call", {
            mode,
            toolName,
            ...(query ? { query } : {}),
          });
        }
      }

      if (message.type === "result") {
        const isError =
          "is_error" in message && Boolean((message as any).is_error);
        const textResult =
          "result" in message ? String((message as any).result ?? "") : "";
        const structured = (message as any).structured_output;
        const errors =
          "errors" in message ? ((message as any).errors as string[]) : [];

        serverLog(options?.runId, "claude-adapter", "analysis-query-result", {
          mode,
          model,
          subtype: message.subtype,
          isError,
          hasStructuredOutput: structured !== undefined,
          hasTextResult: textResult.length > 0,
          errorCount: errors.length,
        });

        if (message.subtype === "success" && !isError) {
          if (mode === "structured") {
            if (structured !== undefined) {
              return structured as T;
            }
            if (textResult.trim().length > 0) {
              try {
                return JSON.parse(textResult) as T;
              } catch (error) {
                throw new Error(
                  `Claude structured output returned invalid JSON text: ${
                    error instanceof Error ? error.message : String(error)
                  }`,
                );
              }
            }
            throw new Error(
              "Claude structured output completed without a usable result",
            );
          }

          if (textResult.trim().length > 0) {
            return textResult;
          }
          if (structured !== undefined) {
            return JSON.stringify(structured);
          }
          throw new Error("Claude JSON fallback completed without text result");
        }

        throw new Error(
          errors.join("; ") ||
            textResult ||
            `Claude ${mode} analysis ended with: ${message.subtype}`,
        );
      }
    }

    if (options?.signal?.aborted) {
      serverWarn(options?.runId, "claude-adapter", "analysis-query-aborted", {
        mode,
        model,
      });
      throw new Error("Aborted");
    }

    serverWarn(options?.runId, "claude-adapter", "analysis-query-no-result", {
      mode,
      model,
    });
    throw new Error(
      mode === "structured"
        ? "Claude structured output ended without terminal result"
        : "Claude JSON fallback ended without terminal result",
    );
  } finally {
    q.close();
  }
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
async function runClaudeStructuredTurn<T = unknown>(
  input: RuntimeStructuredTurnInput,
  session: ClaudeSessionState,
): Promise<T> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const { buildClaudeAgentEnv, getClaudeAgentDebugFilePath } =
    await import("../../utils/resolve-claude-agent-env");
  const { resolveClaudeCli } = await import("../../utils/resolve-claude-cli");

  const env = buildClaudeAgentEnv();
  const debugFile = getClaudeAgentDebugFilePath();
  const claudePath = resolveClaudeCli();
  session.debugFile = debugFile ?? undefined;
  const readOnlyMcp = await createAnalysisMcpServer(input.runId);
  const allowedTools = ANALYSIS_TOOL_NAMES.map(
    (toolName) => `mcp__${ANALYSIS_MCP_SERVER_NAME}__${toolName}`,
  );
  if (input.webSearch !== false) {
    allowedTools.push("WebSearch");
  }

  const runAttempt = async (
    mode: ClaudeAnalysisMode,
    attemptSystemPrompt: string,
  ): Promise<T | string> => {
    const q = buildAnalysisQuery(
      query,
      input.prompt,
      attemptSystemPrompt,
      input.model,
      input.schema,
      allowedTools,
      readOnlyMcp,
      env,
      mode,
      {
        runId: input.runId,
        signal: input.signal,
        maxTurns: input.maxTurns,
        webSearch: input.webSearch,
        onActivity: input.onActivity,
      },
      debugFile,
      claudePath,
    );

    if (!input.signal) {
      return runClaudeAnalysisAttempt<T>(q, mode, input.model, {
        runId: input.runId,
        signal: input.signal,
        webSearch: input.webSearch,
        onActivity: input.onActivity,
      });
    }

    const onAbort = () => q.close();
    input.signal.addEventListener("abort", onAbort, { once: true });
    try {
      return await runClaudeAnalysisAttempt<T>(q, mode, input.model, {
        runId: input.runId,
        signal: input.signal,
        webSearch: input.webSearch,
        onActivity: input.onActivity,
      });
    } finally {
      input.signal.removeEventListener("abort", onAbort);
    }
  };

  try {
    return (await runAttempt("structured", input.systemPrompt)) as T;
  } catch (error) {
    const primaryMessage = error instanceof Error ? error.message : String(error);
    serverWarn(input.runId, "claude-adapter", "analysis-query-failed", {
      mode: "structured",
      model: input.model,
      error: primaryMessage,
    });

    if (!shouldAttemptClaudeJsonFallback(input.model, primaryMessage)) {
      throw error;
    }

    serverWarn(input.runId, "claude-adapter", "analysis-fallback-start", {
      model: input.model,
      reason: primaryMessage,
    });

    try {
      const fallbackResult = await runAttempt(
        "json-fallback",
        buildClaudeJsonFallbackSystemPrompt(
          input.systemPrompt,
          input.schema,
        ),
      );
      serverLog(input.runId, "claude-adapter", "analysis-fallback-success", {
        model: input.model,
      });
      return fallbackResult as T;
    } catch (fallbackError) {
      const fallbackMessage =
        fallbackError instanceof Error
          ? fallbackError.message
          : String(fallbackError);
      serverError(input.runId, "claude-adapter", "analysis-fallback-failed", {
        model: input.model,
        primaryError: primaryMessage,
        fallbackError: fallbackMessage,
      });
      throw new Error(
        `Claude structured-output attempt failed (${primaryMessage}); JSON fallback failed: ${fallbackMessage}`,
      );
    }
  }
}

class ClaudeRuntimeSession implements RuntimeAdapterSession {
  readonly provider = "claude" as const;
  readonly key: RuntimeAdapterSessionKey;
  private readonly state: ClaudeSessionState;

  constructor(key: RuntimeAdapterSessionKey) {
    this.key = key;
    this.state = createClaudeSessionState(key);
  }

  streamChatTurn(input: RuntimeChatTurnInput): AsyncGenerator<ChatEvent> {
    return streamClaudeChatTurn(input, this.state);
  }

  runStructuredTurn<T = unknown>(input: RuntimeStructuredTurnInput): Promise<T> {
    return runClaudeStructuredTurn<T>(input, this.state);
  }

  getDiagnostics(): RuntimeSessionDiagnostics {
    return {
      provider: "claude",
      sessionId: this.state.sessionId,
      ...(this.key.runId ? { runId: this.key.runId } : {}),
      ...(this.state.debugFile ? { logPath: this.state.debugFile } : {}),
      details: {
        ownerId: this.key.ownerId,
      },
    };
  }

  async dispose(): Promise<void> {
    // Claude sessions are per-query in this slice, so there is no shared
    // lifecycle teardown beyond releasing diagnostics metadata.
  }
}

export const claudeRuntimeAdapter: RuntimeAdapter = {
  provider: "claude",
  createSession(key: RuntimeAdapterSessionKey): RuntimeAdapterSession {
    return new ClaudeRuntimeSession(key);
  },
  async listModels() {
    const snapshot = await getClaudeProviderSnapshot();
    return mapRuntimeModels("claude", snapshot.models);
  },
  async checkHealth() {
    return (await getClaudeProviderSnapshot()).health;
  },
};

export async function* streamChat(
  prompt: string,
  systemPrompt: string,
  model: string,
  options?: StreamChatOptions,
): AsyncGenerator<ChatEvent> {
  const session = claudeRuntimeAdapter.createSession({
    ownerId: options?.runId ?? "claude-chat",
    ...(options?.runId ? { runId: options.runId } : {}),
  });

  try {
    yield* session.streamChatTurn({
      prompt,
      systemPrompt,
      model,
      runId: options?.runId,
      signal: options?.signal,
      timeoutMs: options?.timeoutMs,
    });
  } finally {
    await session.dispose();
  }
}

export async function runAnalysisPhase<T = unknown>(
  prompt: string,
  systemPrompt: string,
  model: string,
  schema: Record<string, unknown>,
  options?: AnalysisRunOptions,
): Promise<T> {
  const session = claudeRuntimeAdapter.createSession({
    ownerId: options?.runId ?? "claude-analysis",
    ...(options?.runId ? { runId: options.runId } : {}),
  });

  try {
    return await session.runStructuredTurn<T>({
      prompt,
      systemPrompt,
      model,
      schema,
      maxTurns: options?.maxTurns,
      runId: options?.runId,
      signal: options?.signal,
      timeoutMs: undefined,
      webSearch: options?.webSearch,
      onActivity: options?.onActivity,
    });
  } finally {
    await session.dispose();
  }
}
