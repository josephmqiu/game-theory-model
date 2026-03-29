// analysis-service.ts — per-phase execution engine.
// Delegates to tool-based entity creation via MCP tools.
//
// Does NOT own retries, sequencing, or run lifecycle — that's the orchestrator's job.

import type { MethodologyPhase } from "../../shared/types/methodology";
import {
  isSupportedPhase,
  type PhaseOutputEntity,
  type PhaseOutputRelationship,
} from "./analysis-entity-schemas";
// Re-export for downstream consumers
export type {
  PhaseOutputEntity,
  PhaseOutputRelationship,
} from "./analysis-entity-schemas";
import { createRunLogger } from "../utils/ai-logger";
import type { RunLogger } from "../utils/ai-logger";
import type { AnalysisActivityCallback } from "./ai/analysis-activity";
import type { AnalysisEffortLevel } from "../../shared/types/analysis-runtime";
import type { PromptPackToolPolicy } from "../../shared/types/prompt-pack";
import { buildPhasePromptBundle } from "./analysis-prompt-provenance";
import type { ProviderSessionBindingState } from "./workspace/provider-session-binding-service";
import { clearProviderSessionBinding } from "./workspace/provider-session-binding-service";
import {
  buildHistoryInjectedPrompt,
  buildRecoveryOutcome,
  getBindingService,
  recordResumeDiag,
} from "./ai/adapter-session-utils";
import { buildTokenBudgetedChatHistory } from "./ai/chat-history-budget";

// ── Public types ──

export interface PhaseResult {
  success: boolean;
  entities: PhaseOutputEntity[];
  relationships: PhaseOutputRelationship[];
  error?: string;
}

interface PhaseRuntimeContext {
  webSearch: boolean;
  effortLevel: AnalysisEffortLevel;
}

export interface PhaseContext {
  workspaceId?: string;
  threadId?: string;
  phaseBrief?: string;
  revisionRetryInstruction?: string;
  revisionSystemPrompt?: string;
  provider?: string;
  model?: string;
  runtime?: PhaseRuntimeContext;
  runId?: string;
  phaseTurnId?: string;
  signal?: AbortSignal;
  logger?: RunLogger;
  onActivity?: AnalysisActivityCallback;
  historyMessages?: Array<{ role: string; content: string }>;
  binding?: ProviderSessionBindingState | null;
  /** Pre-built prompts from the orchestrator. Skips redundant buildPhasePromptBundle call. */
  promptBundle?: {
    system: string;
    user: string;
    toolPolicy?: PromptPackToolPolicy;
  };
}

// ── Imports for tool-based delegation ──

import * as entityGraphService from "./entity-graph-service";
import {
  beginPhaseTransaction,
  commitPhaseTransaction,
  rollbackPhaseTransaction,
} from "./revision-diff";
import { PHASE_ENTITY_TYPES } from "./analysis-entity-schemas";

// ── Main entry point (thin wrapper delegating to tool-based path) ──

/**
 * Run a single analysis phase via tool-based execution.
 *
 * Convenience wrapper that creates temporary tool infrastructure,
 * delegates to runPhaseWithTools(), then reads entities/relationships
 * back from the entity graph. Used by the eval-runner.
 *
 * Production callers (orchestrator, revalidation-service) use
 * runPhaseWithTools() directly with their own long-lived tool context.
 */
export async function runPhase(
  phase: MethodologyPhase,
  topic: string,
  context?: PhaseContext,
): Promise<PhaseResult> {
  if (!isSupportedPhase(phase)) {
    return {
      success: false,
      entities: [],
      relationships: [],
      error: `Unsupported phase: ${phase}`,
    };
  }

  if (context?.signal?.aborted) {
    return {
      success: false,
      entities: [],
      relationships: [],
      error: "Aborted",
    };
  }

  // Build tool-based prompt bundle
  const promptBundle =
    context?.promptBundle ??
    buildPhasePromptBundle({
      phase,
      topic,
      phaseBrief: context?.phaseBrief,
      revisionRetryInstruction: context?.revisionRetryInstruction,
      revisionSystemPrompt: context?.revisionSystemPrompt,
      effortLevel: context?.runtime?.effortLevel ?? "medium",
    });

  // Create temporary tool infrastructure
  const { createToolBasedAnalysisMcpServer } =
    await import("./ai/claude-adapter");
  const writeContext: import("./analysis-tools").AnalysisWriteContext = {
    workspaceId: context?.workspaceId,
    threadId: context?.threadId,
    runId: context?.runId,
    phaseTurnId: context?.phaseTurnId,
    phase,
    allowedEntityTypes: PHASE_ENTITY_TYPES[phase] ?? [],
    counters: {
      entitiesCreated: 0,
      entitiesUpdated: 0,
      entitiesDeleted: 0,
      relationshipsCreated: 0,
      phaseCompleted: false,
    },
  };
  const toolMcpServer = await createToolBasedAnalysisMcpServer(writeContext);

  // Run with phase transaction
  beginPhaseTransaction(phase, context?.runId ?? `eval-${Date.now()}`);
  try {
    const toolResult = await runPhaseWithTools(
      phase,
      topic,
      toolMcpServer,
      writeContext,
      {
        ...context,
        promptBundle: {
          system:
            typeof promptBundle === "object" && "system" in promptBundle
              ? promptBundle.system
              : "",
          user:
            typeof promptBundle === "object" && "user" in promptBundle
              ? promptBundle.user
              : "",
          toolPolicy:
            typeof promptBundle === "object" && "toolPolicy" in promptBundle
              ? promptBundle.toolPolicy
              : undefined,
        },
      },
    );

    if (!toolResult.success || !toolResult.phaseCompleted) {
      rollbackPhaseTransaction();
      return {
        success: false,
        entities: [],
        relationships: [],
        error: toolResult.error ?? "Phase did not complete",
      };
    }

    commitPhaseTransaction();

    // Read entities/relationships back from the entity graph
    const entities = entityGraphService.getEntitiesByPhase(phase);
    const relationships = entityGraphService.getRelationships();

    // Convert to PhaseResult format
    const phaseEntities: PhaseOutputEntity[] = entities.map(
      (e) =>
        ({
          id: e.id,
          ref: e.id, // AnalysisEntity doesn't store ref; use id
          type: e.type,
          phase: e.phase,
          confidence: e.confidence,
          rationale: e.rationale,
          data: e.data,
        }) as unknown as PhaseOutputEntity,
    );

    const phaseRelationships: PhaseOutputRelationship[] = relationships
      .filter((r) => {
        const fromEntity = entities.find((e) => e.id === r.fromEntityId);
        const toEntity = entities.find((e) => e.id === r.toEntityId);
        return fromEntity || toEntity;
      })
      .map((r) => ({
        id: r.id,
        type: r.type,
        fromEntityId: r.fromEntityId,
        toEntityId: r.toEntityId,
        metadata: r.metadata,
      }));

    return {
      success: true,
      entities: phaseEntities,
      relationships: phaseRelationships,
    };
  } catch (err) {
    rollbackPhaseTransaction();
    return {
      success: false,
      entities: [],
      relationships: [],
      error: `Phase execution error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ── Tool-based phase execution ──

/** Must match the constant in claude-adapter.ts. Duplicated here to avoid
 *  importing claude-adapter from analysis-service (which changes module
 *  loading order and breaks test mocking). */
const TOOL_BASED_ANALYSIS_MCP_SERVER_NAME = "game-theory-analysis-tools";

export interface PhaseToolResult {
  success: boolean;
  error?: string;
  entitiesCreated: number;
  entitiesUpdated: number;
  entitiesDeleted: number;
  relationshipsCreated: number;
  phaseCompleted: boolean;
  assistantResponse?: string;
}

const TOOL_BASED_MAX_TURNS = 36;

function shouldRetryToolPhaseWithoutResume(errorMessage: string): boolean {
  return /resume|session|conversation|not found|invalid|stale|expired/i.test(
    errorMessage,
  );
}

function captureToolPhaseProviderSessionId(
  message: unknown,
  input: {
    workspaceId?: string;
    threadId?: string;
    runId?: string;
    phaseTurnId?: string;
    binding: ProviderSessionBindingState | null | undefined;
    providerSessionId?: string;
  },
): { providerSessionId?: string; binding: ProviderSessionBindingState | null } {
  if (!message || typeof message !== "object") {
    return {
      providerSessionId: input.providerSessionId,
      binding: input.binding ?? null,
    };
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

  if (!candidate || candidate === input.providerSessionId) {
    return {
      providerSessionId: input.providerSessionId,
      binding: input.binding ?? null,
    };
  }

  if (!input.workspaceId || !input.threadId) {
    return {
      providerSessionId: candidate,
      binding: input.binding ?? null,
    };
  }

  const bindingService = getBindingService();
  const binding = bindingService.upsertBinding({
    version: 1,
    provider: "claude",
    workspaceId: input.workspaceId,
    threadId: input.threadId,
    purpose: "analysis",
    ...(input.runId ? { runId: input.runId } : {}),
    ...(input.phaseTurnId ? { phaseTurnId: input.phaseTurnId } : {}),
    providerSessionId: candidate,
    claudeSessionId: candidate,
    updatedAt: Date.now(),
  });

  return {
    providerSessionId: candidate,
    binding,
  };
}

/**
 * Run a single analysis phase using the tool-based execution path.
 *
 * Unlike runPhase() which creates/disposes a session per call and expects
 * structured JSON output, this function:
 * - Receives a persistent MCP server (shared across phases)
 * - Does NOT create/dispose sessions — the SDK query() handles that
 * - Relies on the MCP server's write tools for entity creation
 * - Reads results from writeContext.counters after the query completes
 *
 * Does NOT call beginPhaseTransaction/commitPhaseTransaction — the
 * orchestrator wraps those around this call.
 */
export async function runPhaseWithTools(
  phase: MethodologyPhase,
  topic: string,
  toolMcpServer: unknown,
  writeContext: import("./analysis-tools").AnalysisWriteContext,
  context?: PhaseContext,
): Promise<PhaseToolResult> {
  if (!isSupportedPhase(phase)) {
    return {
      success: false,
      error: `Unsupported phase: ${phase}`,
      entitiesCreated: 0,
      entitiesUpdated: 0,
      entitiesDeleted: 0,
      relationshipsCreated: 0,
      phaseCompleted: false,
    };
  }

  if (context?.signal?.aborted) {
    return {
      success: false,
      error: "Aborted",
      entitiesCreated: 0,
      entitiesUpdated: 0,
      entitiesDeleted: 0,
      relationshipsCreated: 0,
      phaseCompleted: false,
    };
  }

  const logger =
    context?.logger ??
    createRunLogger(
      `svc-tools-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    );

  const { system, user } =
    context?.promptBundle ??
    buildPhasePromptBundle({
      phase,
      topic,
      phaseBrief: context?.phaseBrief,
      effortLevel: context?.runtime?.effortLevel ?? "medium",
    });

  const model = context?.model ?? "claude-sonnet-4-20250514";
  const logContext = context?.phaseTurnId
    ? { phaseTurnId: context.phaseTurnId }
    : {};
  const bindingService = getBindingService();
  let binding = context?.binding ?? null;
  let providerSessionId =
    binding?.provider === "claude"
      ? (binding.claudeSessionId ?? binding.providerSessionId)
      : undefined;
  const hadResumeBinding = Boolean(providerSessionId);

  if (providerSessionId && context?.workspaceId && context?.threadId) {
    recordResumeDiag(
      bindingService,
      {
        workspaceId: context.workspaceId,
        threadId: context.threadId,
        ...(context.runId ? { runId: context.runId } : {}),
        ...(context.phaseTurnId ? { phaseTurnId: context.phaseTurnId } : {}),
        purpose: "analysis",
      },
      "claude",
      "resume-attempt",
      "Attempting Claude Code session resume for analysis phase",
      providerSessionId,
    );
  }

  logger.log("analysis-service", "tool-phase-start", {
    phase,
    model,
    ...logContext,
  });
  context?.onActivity?.({ kind: "note", message: "Preparing phase analysis" });

  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const { buildClaudeAgentEnv, getClaudeAgentDebugFilePath } =
    await import("../utils/resolve-claude-agent-env");
  const { resolveClaudeCli } = await import("../utils/resolve-claude-cli");

  const env = buildClaudeAgentEnv();
  const debugFile = getClaudeAgentDebugFilePath();
  const claudePath = resolveClaudeCli();

  const { ANALYSIS_TOOL_BASED_NAMES } = await import("./ai/tool-surfaces");
  const allowedTools = ANALYSIS_TOOL_BASED_NAMES.map(
    (name: string) => `mcp__${TOOL_BASED_ANALYSIS_MCP_SERVER_NAME}__${name}`,
  );
  const webSearchEnabled =
    context?.promptBundle?.toolPolicy?.webSearch ??
    context?.runtime?.webSearch ??
    true;
  if (webSearchEnabled) {
    allowedTools.push("WebSearch");
  }

  const q = query({
    prompt: (async function* () {
      yield {
        type: "user" as const,
        message: { role: "user" as const, content: user },
        parent_tool_use_id: null,
        session_id: "analysis-phase",
      };
    })(),
    options: {
      systemPrompt:
        !providerSessionId && context?.historyMessages?.length
          ? buildHistoryInjectedPrompt(
              system,
              buildTokenBudgetedChatHistory({
                messages: context.historyMessages,
                provider: "claude",
                model,
                systemPrompt: system,
                nextUserMessage: user,
              }),
            )
          : system,
      model,
      maxTurns: TOOL_BASED_MAX_TURNS,
      allowedTools,
      mcpServers: {
        [TOOL_BASED_ANALYSIS_MCP_SERVER_NAME]: toolMcpServer as any,
      },
      includePartialMessages: true,
      permissionMode: "dontAsk",
      persistSession: true,
      settingSources: [],
      plugins: [],
      env,
      ...(providerSessionId ? { resume: providerSessionId } : {}),
      ...(debugFile ? { debugFile } : {}),
      ...(claudePath ? { pathToClaudeCodeExecutable: claudePath } : {}),
    },
  });

  const onAbort = () => q.close();
  context?.signal?.addEventListener("abort", onAbort, { once: true });
  let assistantResponse = "";

  try {
    for await (const message of q) {
      ({ providerSessionId, binding } = captureToolPhaseProviderSessionId(
        message,
        {
          workspaceId: context?.workspaceId,
          threadId: context?.threadId,
          runId: context?.runId,
          phaseTurnId: context?.phaseTurnId,
          binding: binding ?? null,
          providerSessionId,
        },
      ));
      if (context?.signal?.aborted) {
        logger.warn("analysis-service", "tool-phase-aborted", {
          phase,
          ...logContext,
        });
        break;
      }

      // Track tool calls for activity events
      if (message.type === "stream_event") {
        const ev = (message as any).event;
        if (ev?.type === "content_block_start") {
          const block = ev.content_block;
          if (
            block &&
            (block.type === "tool_use" || block.type === "server_tool_use")
          ) {
            const toolName: string = block.name ?? "unknown";
            // Strip MCP prefix for cleaner logging
            const shortName = toolName.replace(
              `mcp__${TOOL_BASED_ANALYSIS_MCP_SERVER_NAME}__`,
              "",
            );
            context?.onActivity?.({
              kind:
                shortName === "WebSearch" || toolName === "WebSearch"
                  ? "web-search"
                  : "tool",
              message: `Using ${shortName}`,
              toolName: shortName,
            });
            logger.log("analysis-service", "tool-phase-tool-call", {
              phase,
              toolName: shortName,
              ...logContext,
            });
          }
        }
      } else if (message.type === "assistant") {
        const assistantMessage = message as {
          message?: { content?: Array<{ type?: string; text?: string }> };
          content?: Array<{ type?: string; text?: string }>;
        };
        const content =
          assistantMessage.message?.content ?? assistantMessage.content ?? [];
        const text = content
          .filter((block) => block?.type === "text")
          .map((block) => block.text ?? "")
          .join("");
        if (text.trim().length > 0) {
          assistantResponse = text.trim();
        }
      }

      if (message.type === "result") {
        const subtype = (message as any).subtype;
        const resultText =
          typeof (message as { result?: unknown }).result === "string"
            ? ((message as { result?: string }).result ?? "")
            : "";
        if (resultText.trim().length > 0) {
          assistantResponse = resultText.trim();
        }
        if (subtype !== "success" || (message as any).is_error) {
          const errors: string[] = (message as any).errors ?? [];
          const errMsg = errors.join("; ") || "Query ended without success";
          logger.error("analysis-service", "tool-phase-query-failed", {
            phase,
            error: errMsg,
            subtype,
            isError: (message as any).is_error,
            rawErrors: errors,
            ...logContext,
          });
          return {
            success: false,
            error: errMsg,
            entitiesCreated: writeContext.counters?.entitiesCreated ?? 0,
            entitiesUpdated: writeContext.counters?.entitiesUpdated ?? 0,
            entitiesDeleted: writeContext.counters?.entitiesDeleted ?? 0,
            relationshipsCreated:
              writeContext.counters?.relationshipsCreated ?? 0,
            phaseCompleted: writeContext.counters?.phaseCompleted ?? false,
            ...(assistantResponse ? { assistantResponse } : {}),
          };
        }
        break;
      }
    }
  } catch (err) {
    if (context?.signal?.aborted) {
      return {
        success: false,
        error: "Aborted",
        entitiesCreated: writeContext.counters?.entitiesCreated ?? 0,
        entitiesUpdated: writeContext.counters?.entitiesUpdated ?? 0,
        entitiesDeleted: writeContext.counters?.entitiesDeleted ?? 0,
        relationshipsCreated: writeContext.counters?.relationshipsCreated ?? 0,
        phaseCompleted: writeContext.counters?.phaseCompleted ?? false,
        ...(assistantResponse ? { assistantResponse } : {}),
      };
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    if (
      providerSessionId &&
      context?.threadId &&
      shouldRetryToolPhaseWithoutResume(errMsg) &&
      (writeContext.counters?.entitiesCreated ?? 0) === 0 &&
      (writeContext.counters?.entitiesUpdated ?? 0) === 0 &&
      (writeContext.counters?.entitiesDeleted ?? 0) === 0 &&
      (writeContext.counters?.relationshipsCreated ?? 0) === 0
    ) {
      clearProviderSessionBinding(context.threadId, {
        runId: context.runId,
        purpose: "analysis",
        reason: "provider_rejected_binding",
      });
      return runPhaseWithTools(phase, topic, toolMcpServer, writeContext, {
        ...context,
        binding: null,
      });
    }
    logger.error("analysis-service", "tool-phase-error", {
      phase,
      error: errMsg,
      ...logContext,
    });
    return {
      success: false,
      error: errMsg,
      entitiesCreated: writeContext.counters?.entitiesCreated ?? 0,
      entitiesUpdated: writeContext.counters?.entitiesUpdated ?? 0,
      entitiesDeleted: writeContext.counters?.entitiesDeleted ?? 0,
      relationshipsCreated: writeContext.counters?.relationshipsCreated ?? 0,
      phaseCompleted: writeContext.counters?.phaseCompleted ?? false,
      ...(assistantResponse ? { assistantResponse } : {}),
    };
  } finally {
    context?.signal?.removeEventListener("abort", onAbort);
  }

  if (binding) {
    bindingService.recordOutcome(
      binding,
      buildRecoveryOutcome(
        hadResumeBinding ? "resumed" : "started_fresh",
        hadResumeBinding
          ? "Claude Code resumed a persisted analysis session"
          : "Claude Code started a fresh analysis session",
      ),
    );
  }

  const counters = writeContext.counters;
  const phaseCompleted = counters?.phaseCompleted ?? false;

  logger.log("analysis-service", "tool-phase-complete", {
    phase,
    phaseCompleted,
    entitiesCreated: counters?.entitiesCreated ?? 0,
    entitiesUpdated: counters?.entitiesUpdated ?? 0,
    entitiesDeleted: counters?.entitiesDeleted ?? 0,
    relationshipsCreated: counters?.relationshipsCreated ?? 0,
    ...logContext,
  });

  return {
    success: phaseCompleted,
    entitiesCreated: counters?.entitiesCreated ?? 0,
    entitiesUpdated: counters?.entitiesUpdated ?? 0,
    entitiesDeleted: counters?.entitiesDeleted ?? 0,
    relationshipsCreated: counters?.relationshipsCreated ?? 0,
    phaseCompleted,
    ...(assistantResponse ? { assistantResponse } : {}),
    ...(!phaseCompleted ? { error: "AI did not call complete_phase" } : {}),
  };
}
