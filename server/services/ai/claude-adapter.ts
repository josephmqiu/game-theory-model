// Claude adapter — the ONLY file that imports from @anthropic-ai/claude-agent-sdk.
// Provides two profiles: streamChat (interactive) and runAnalysisPhase (structured).

import type { ChatEvent } from "../../../shared/types/events";
import type {
  AnalysisRunOptions,
  RuntimeAdapter,
  RuntimeAdapterSession,
  RuntimeAdapterSessionContext,
  RuntimeChatTurnInput,
  RuntimeSessionDiagnostics,
  RuntimeStructuredTurnInput,
  StreamChatOptions,
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
  type AnalysisToolContext,
} from "../analysis-tools";
import {
  ANALYSIS_TOOL_NAMES,
  CHAT_TOOL_NAMES,
  type AnalysisToolName,
} from "./tool-surfaces";
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
  handleAskUser,
} from "../../mcp/product-tools";
import { analysisRuntimeConfig } from "../../config/analysis-runtime";
import { getClaudeProviderSnapshot } from "./claude-health";
import {
  type ProviderSessionBindingRecoveryOutcome,
  type ProviderSessionBindingState,
} from "../workspace/provider-session-binding-service";
import {
  getBindingService,
  type BindingService,
  buildRecoveryOutcome,
  recordResumeDiag,
  buildHistoryInjectedPrompt,
} from "./adapter-session-utils";
import {
  narrowSdkResult,
  narrowContentBlock,
  extractMessageContent,
  type SdkStreamMessage,
} from "./claude-sdk-types";

type ClaudeAnalysisMode = "structured" | "json-fallback";

interface ClaudeSessionState {
  sessionId: string;
  context: RuntimeAdapterSessionContext;
  providerSessionId?: string;
  binding: ProviderSessionBindingState | null;
  recovery?: ProviderSessionBindingRecoveryOutcome;
  debugFile?: string;
}

function createClaudeSessionState(
  context: RuntimeAdapterSessionContext,
  binding: ProviderSessionBindingState | null = null,
): ClaudeSessionState {
  return {
    sessionId: `claude-${context.threadId}-${Math.random().toString(36).slice(2, 10)}`,
    context,
    binding,
    ...(binding?.provider === "claude"
      ? { providerSessionId: binding.providerSessionId }
      : {}),
  };
}

function getClaudeBindingService() {
  return getBindingService();
}

function captureClaudeProviderSessionId(
  message: unknown,
  session: ClaudeSessionState,
): string | undefined {
  if (!message || typeof message !== "object") {
    return session.providerSessionId;
  }

  const record = message as Record<string, unknown>;
  const nestedMessage =
    record.message && typeof record.message === "object"
      ? (record.message as Record<string, unknown>)
      : null;
  const candidate =
    typeof record.session_id === "string"
      ? record.session_id
      : typeof nestedMessage?.session_id === "string"
        ? nestedMessage.session_id
        : undefined;

  if (!candidate || candidate === session.providerSessionId) {
    return session.providerSessionId;
  }

  session.providerSessionId = candidate;
  if (!session.context.workspaceId) {
    return candidate;
  }

  const bindingService = getClaudeBindingService();
  session.binding = bindingService.upsertBinding({
    version: 1,
    provider: "claude",
    workspaceId: session.context.workspaceId,
    threadId: session.context.threadId,
    purpose: session.context.purpose,
    ...(session.context.runId ? { runId: session.context.runId } : {}),
    ...(session.context.phaseTurnId
      ? { phaseTurnId: session.context.phaseTurnId }
      : {}),
    providerSessionId: candidate,
    claudeSessionId: candidate,
    updatedAt: Date.now(),
    ...(session.recovery ? { lastRecoveryOutcome: session.recovery } : {}),
  });
  return candidate;
}

function getClaudeResumeSessionId(
  session: ClaudeSessionState,
): string | undefined {
  if (session.binding?.provider === "claude") {
    return session.binding.claudeSessionId;
  }
  return session.providerSessionId;
}

type ClaudeBindingService = BindingService;

function handleClaudeResumeFailure(
  session: ClaudeSessionState,
  bindingService: ClaudeBindingService,
  resumeSessionId: string,
  errorMessage: string,
): void {
  recordResumeDiag(
    bindingService,
    session.context,
    "claude",
    "resume-failed",
    "Claude Code session resume failed",
    resumeSessionId,
    { error: errorMessage },
  );
  bindingService.clearBinding(session.context.threadId, {
    workspaceId: session.context.workspaceId,
    runId: session.context.runId,
    phaseTurnId: session.context.phaseTurnId,
    provider: "claude",
    providerSessionId: resumeSessionId,
    reason: "provider_rejected_binding",
    message: "Cleared stale Claude Code session binding after resume failure",
  });
  session.binding = null;
  session.providerSessionId = undefined;
  session.recovery = buildRecoveryOutcome(
    "started_fresh",
    "Claude Code started a fresh provider session after stored session resume failed",
  );
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

function shouldRetryClaudeWithoutResume(errorMessage: string): boolean {
  return /resume|session|conversation|not found|invalid|stale|expired/i.test(
    errorMessage,
  );
}

// Re-export McpSdkServerConfigWithInstance so callers don't import the SDK directly
export type { McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";

// ── Product MCP server ──

/**
 * Build an in-process MCP server exposing the chat-mode product tools.
 * Uses createSdkMcpServer() + tool() from the Agent SDK.
 *
 * Chat tools intentionally omit AnalysisToolContext — there is no active
 * analysis run during chat, so read-only tools (getEntity, queryEntities,
 * queryRelationships) operate on the global entity graph without run
 * attribution. requestLoopback writes to the __unassigned__ run key,
 * which is harmless — the orchestrator only reads triggers keyed by runId.
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
            text: await handleCreateEntity({
              type: args.type,
              phase: args.phase,
              data: args.data,
              confidence: args.confidence,
              rationale: args.rationale,
              revision: args.revision,
            }),
          },
        ],
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
            text: await handleUpdateEntity({
              id: args.id,
              updates: args.updates,
            }),
          },
        ],
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
            text: await handleCreateRelationship({
              type: args.type,
              fromId: args.fromId,
              toId: args.toId,
              metadata: args.metadata,
            }),
          },
        ],
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
            text: await handleDeleteRelationship({ id: args.id }),
          },
        ],
      }),
    ),
    tool(
      "rerun_phases",
      "Rerun analysis from the earliest specified phase",
      { phases: z.array(z.string()) },
      async (args) => ({
        content: [
          { type: "text" as const, text: await handleRerunPhases(args) },
        ],
      }),
    ),
    tool("abort_analysis", "Abort the active analysis", {}, async () => ({
      content: [{ type: "text" as const, text: await handleAbortAnalysis() }],
    })),
    tool(
      "ask_user",
      "Ask the user clarifying questions about assumptions, motivations, or boundaries",
      {
        questions: z.array(
          z.object({
            header: z.string().optional(),
            question: z.string(),
            options: z
              .array(
                z.object({
                  label: z.string(),
                  description: z.string().optional(),
                }),
              )
              .optional(),
            multiSelect: z.boolean().optional(),
          }),
        ),
      },
      async (args) => ({
        content: [{ type: "text" as const, text: await handleAskUser(args) }],
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

export async function createAnalysisMcpServer(
  contextOrRunId: AnalysisToolContext | string = {},
  toolNames: readonly AnalysisToolName[] = ANALYSIS_TOOL_NAMES,
) {
  const { createSdkMcpServer, tool } =
    await import("@anthropic-ai/claude-agent-sdk");
  const { z } = await import("zod/v4");

  const normalizedContext =
    typeof contextOrRunId === "string"
      ? { runId: contextOrRunId }
      : contextOrRunId;
  const toolContext: AnalysisToolContext = {
    ...(normalizedContext.workspaceId
      ? { workspaceId: normalizedContext.workspaceId }
      : {}),
    ...(normalizedContext.threadId
      ? { threadId: normalizedContext.threadId }
      : {}),
    ...(normalizedContext.runId ? { runId: normalizedContext.runId } : {}),
    ...(normalizedContext.phaseTurnId
      ? { phaseTurnId: normalizedContext.phaseTurnId }
      : {}),
  };

  const requestedToolSet = new Set(toolNames);
  const tools = [];

  if (requestedToolSet.has("get_entity")) {
    tools.push(
      tool(
        "get_entity",
        "Get a single analysis entity by ID",
        { id: z.string() },
        async (args) => ({
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(getEntity(args.id, toolContext)),
            },
          ],
        }),
      ),
    );
  }

  if (requestedToolSet.has("query_entities")) {
    tools.push(
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
              text: JSON.stringify(queryEntities(args, toolContext)),
            },
          ],
        }),
      ),
    );
  }

  if (requestedToolSet.has("query_relationships")) {
    tools.push(
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
              text: JSON.stringify(queryRelationships(args, toolContext)),
            },
          ],
        }),
      ),
    );
  }

  if (requestedToolSet.has("request_loopback")) {
    tools.push(
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
              text: JSON.stringify(requestLoopback(args, toolContext)),
            },
          ],
        }),
      ),
    );
  }

  if (requestedToolSet.has("ask_user")) {
    tools.push(
      tool(
        "ask_user",
        "Ask the user clarifying questions about assumptions, motivations, or boundaries",
        {
          questions: z.array(
            z.object({
              header: z.string().optional(),
              question: z.string(),
              options: z
                .array(
                  z.object({
                    label: z.string(),
                    description: z.string().optional(),
                  }),
                )
                .optional(),
              multiSelect: z.boolean().optional(),
            }),
          ),
        },
        async (args) => ({
          content: [{ type: "text" as const, text: await handleAskUser(args) }],
        }),
      ),
    );
  }

  return createSdkMcpServer({
    name: ANALYSIS_MCP_SERVER_NAME,
    version: "1.0.0",
    tools,
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
  allowResumeRetry = true,
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
  const bindingService = getClaudeBindingService();
  const resumeSessionId = getClaudeResumeSessionId(session);

  const chatMcp = await createChatMcpServer();
  const allowedTools = [
    ...CHAT_TOOL_NAMES.map(
      (toolName) => `mcp__${CHAT_MCP_SERVER_NAME}__${toolName}`,
    ),
    "WebSearch",
  ];

  if (resumeSessionId) {
    recordResumeDiag(
      bindingService,
      session.context,
      "claude",
      "resume-attempt",
      "Attempting Claude Code session resume",
      resumeSessionId,
    );
  }

  // For non-resumed sessions, prepend conversation history into the system
  // prompt so the model has context. Resumed sessions already have the full
  // conversation in the SDK's persisted state.
  const effectiveSystemPrompt =
    !resumeSessionId && input.messages && input.messages.length > 0
      ? buildHistoryInjectedPrompt(input.systemPrompt, input.messages)
      : input.systemPrompt;

  const q = query({
    prompt: input.prompt,
    options: {
      systemPrompt: effectiveSystemPrompt,
      model: input.model,
      maxTurns: 99,
      tools: ["WebSearch"],
      allowedTools,
      mcpServers: { chat: chatMcp },
      includePartialMessages: true,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      persistSession: true,
      settingSources: [],
      plugins: [],
      ...(resumeSessionId ? { resume: resumeSessionId } : {}),
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
      captureClaudeProviderSessionId(message, session);
      if (message.type === "stream_event") {
        const ev = message.event;
        if (ev.type === "content_block_delta") {
          if (ev.delta.type === "text_delta") {
            yield { type: "text_delta", content: ev.delta.text };
          }
          // thinking deltas are silently consumed (not part of ChatEvent schema)
        } else if (ev.type === "content_block_start") {
          if ("content_block" in ev) {
            const block = narrowContentBlock(ev.content_block);
            if (block.type === "tool_use") {
              yield {
                type: "tool_call_start",
                toolName: block.name ?? "unknown",
                input: block.input ?? {},
              };
            }
          }
        }
      } else if (message.type === "assistant") {
        // Track last assistant text for fallback
        const content = extractMessageContent(message);
        if (content) {
          // Extract tool results from content blocks
          for (const raw of content) {
            const block = narrowContentBlock(raw);
            if (block.type === "tool_use") {
              // tool_use blocks in assistant message indicate tool invocation;
              // the result comes from tool_result blocks in subsequent user messages,
              // but the SDK doesn't expose those directly. We emit start here if
              // we didn't already from stream_event.
            } else if (block.type === "tool_result") {
              const toolResultRecord = raw as Record<string, unknown>;
              yield {
                type: "tool_call_result",
                toolName:
                  (typeof toolResultRecord.tool_name === "string"
                    ? toolResultRecord.tool_name
                    : block.name) ?? "unknown",
                output: block.content ?? raw,
              };
            }
          }
          const text = content
            .map((b) => narrowContentBlock(b))
            .filter((b) => b.type === "text")
            .map((b) => b.text ?? "")
            .join("");
          if (text) lastAssistantText = text;
        }
      } else if (message.type === "result") {
        gotResult = true;
        const result = narrowSdkResult(message);
        if (message.subtype === "success" && !result.is_error) {
          yield { type: "turn_complete" };
        } else {
          const msg =
            (result.errors ?? []).join("; ") ||
            (result.result ?? "") ||
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
        error: createProviderRuntimeError(
          "Chat turn timed out after 5 minutes",
          {
            provider: "claude",
            reason: "unavailable",
            retryable: true,
          },
        ),
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

    if (resumeSessionId) {
      session.recovery = buildRecoveryOutcome(
        "resumed",
        "Claude Code resumed a persisted session",
      );
      recordResumeDiag(
        bindingService,
        session.context,
        "claude",
        "resume-succeeded",
        "Claude Code session resume succeeded",
        resumeSessionId,
      );
    } else if (session.providerSessionId) {
      session.recovery = buildRecoveryOutcome(
        "started_fresh",
        "Claude Code started a fresh provider session",
      );
      if (session.binding) {
        bindingService.recordOutcome(session.binding, session.recovery);
      }
    }
  } catch (err) {
    // Suppress errors caused by abort (client disconnect)
    if (aborted) return;
    const msg = err instanceof Error ? err.message : String(err);
    if (
      resumeSessionId &&
      allowResumeRetry &&
      shouldRetryClaudeWithoutResume(msg)
    ) {
      handleClaudeResumeFailure(session, bindingService, resumeSessionId, msg);
      yield* streamClaudeChatTurn(input, session, false);
      return;
    }
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
  resumeSessionId?: string,
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
      persistSession: true,
      settingSources: [],
      plugins: [],
      ...(resumeSessionId ? { resume: resumeSessionId } : {}),
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
  q: { close: () => void } & AsyncIterable<SdkStreamMessage>,
  mode: ClaudeAnalysisMode,
  model: string,
  session: ClaudeSessionState,
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
      captureClaudeProviderSessionId(message, session);
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
              serverLog(
                options?.runId,
                "claude-adapter",
                "analysis-tool-call",
                {
                  mode,
                  toolName: toolInputState.toolName,
                  query,
                  streamedInput: true,
                },
              );
            }
          }
        }
        if (ev?.type === "content_block_start") {
          const block = narrowContentBlock(ev.content_block);
          if (block.type === "tool_use" || block.type === "server_tool_use") {
            const toolName = block.name ?? "unknown";
            const input = block.input;
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
      }

      if (message.type === "result") {
        const result = narrowSdkResult(message);
        const textResult = result.result ?? "";
        const structured = result.structured_output;
        const errors = result.errors ?? [];

        serverLog(options?.runId, "claude-adapter", "analysis-query-result", {
          mode,
          model,
          subtype: message.subtype,
          isError: result.is_error ?? false,
          hasStructuredOutput: structured !== undefined,
          hasTextResult: textResult.length > 0,
          errorCount: errors.length,
        });

        if (message.subtype === "success" && !result.is_error) {
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
  const bindingService = getClaudeBindingService();
  const resumeSessionId = getClaudeResumeSessionId(session);
  const allowedToolNames = (input.allowedToolNames?.filter(
    (toolName): toolName is AnalysisToolName =>
      (ANALYSIS_TOOL_NAMES as readonly string[]).includes(toolName),
  ) ?? [...ANALYSIS_TOOL_NAMES]) as AnalysisToolName[];
  const readOnlyMcp = await createAnalysisMcpServer(
    {
      workspaceId: session.context.workspaceId,
      threadId: session.context.threadId,
      runId: input.runId,
      phaseTurnId: session.context.phaseTurnId,
    },
    allowedToolNames,
  );
  const allowedTools = allowedToolNames.map(
    (toolName) => `mcp__${ANALYSIS_MCP_SERVER_NAME}__${toolName}`,
  );
  if (input.webSearch !== false) {
    allowedTools.push("WebSearch");
  }

  if (resumeSessionId) {
    recordResumeDiag(
      bindingService,
      session.context,
      "claude",
      "resume-attempt",
      "Attempting Claude Code session resume",
      resumeSessionId,
    );
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
      resumeSessionId,
    );

    if (!input.signal) {
      return runClaudeAnalysisAttempt<T>(q, mode, input.model, session, {
        runId: input.runId,
        signal: input.signal,
        webSearch: input.webSearch,
        onActivity: input.onActivity,
      });
    }

    const onAbort = () => q.close();
    input.signal.addEventListener("abort", onAbort, { once: true });
    try {
      return await runClaudeAnalysisAttempt<T>(q, mode, input.model, session, {
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
    const result = (await runAttempt("structured", input.systemPrompt)) as T;
    if (resumeSessionId) {
      session.recovery = buildRecoveryOutcome(
        "resumed",
        "Claude Code resumed a persisted session",
      );
      recordResumeDiag(
        bindingService,
        session.context,
        "claude",
        "resume-succeeded",
        "Claude Code session resume succeeded",
        resumeSessionId,
      );
      if (session.binding) {
        bindingService.recordOutcome(session.binding, session.recovery);
      }
    } else if (session.binding) {
      session.recovery = buildRecoveryOutcome(
        "started_fresh",
        "Claude Code started a fresh provider session",
      );
      bindingService.recordOutcome(session.binding, session.recovery);
    }
    return result;
  } catch (error) {
    const primaryMessage =
      error instanceof Error ? error.message : String(error);
    if (resumeSessionId && shouldRetryClaudeWithoutResume(primaryMessage)) {
      handleClaudeResumeFailure(
        session,
        bindingService,
        resumeSessionId,
        primaryMessage,
      );
      const freshSession = createClaudeSessionState(session.context, null);
      freshSession.debugFile = session.debugFile;
      freshSession.recovery = session.recovery;
      return runClaudeStructuredTurn<T>(input, freshSession);
    }
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
        buildClaudeJsonFallbackSystemPrompt(input.systemPrompt, input.schema),
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
  readonly context: RuntimeAdapterSessionContext;
  private readonly state: ClaudeSessionState;

  constructor(
    context: RuntimeAdapterSessionContext,
    binding: ProviderSessionBindingState | null = null,
  ) {
    this.context = context;
    this.state = createClaudeSessionState(context, binding);
  }

  streamChatTurn(input: RuntimeChatTurnInput): AsyncGenerator<ChatEvent> {
    return streamClaudeChatTurn(input, this.state);
  }

  runStructuredTurn<T = unknown>(
    input: RuntimeStructuredTurnInput,
  ): Promise<T> {
    return runClaudeStructuredTurn<T>(input, this.state);
  }

  getDiagnostics(): RuntimeSessionDiagnostics {
    return {
      provider: "claude",
      sessionId: this.state.sessionId,
      ...(this.context.runId ? { runId: this.context.runId } : {}),
      ...(this.state.providerSessionId
        ? { providerSessionId: this.state.providerSessionId }
        : {}),
      ...(this.state.debugFile ? { logPath: this.state.debugFile } : {}),
      ...(this.state.recovery ? { recovery: this.state.recovery } : {}),
      details: {
        workspaceId: this.context.workspaceId,
        threadId: this.context.threadId,
        purpose: this.context.purpose,
      },
    };
  }

  getBinding(): ProviderSessionBindingState | null {
    return this.state.binding;
  }

  async dispose(): Promise<void> {
    // Claude sessions are per-query in this slice, so there is no shared
    // lifecycle teardown beyond releasing diagnostics metadata.
  }
}

export const claudeRuntimeAdapter: RuntimeAdapter = {
  provider: "claude",
  createSession(
    context: RuntimeAdapterSessionContext,
    binding?: ProviderSessionBindingState | null,
  ): RuntimeAdapterSession {
    return new ClaudeRuntimeSession(context, binding ?? null);
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
    threadId: options?.runId ?? "claude-chat",
    ...(options?.runId ? { runId: options.runId } : {}),
    purpose: "chat",
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
    threadId: options?.runId ?? "claude-analysis",
    ...(options?.runId ? { runId: options.runId } : {}),
    purpose: "analysis",
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
      allowedToolNames: options?.allowedToolNames,
      onActivity: options?.onActivity,
    });
  } finally {
    await session.dispose();
  }
}
