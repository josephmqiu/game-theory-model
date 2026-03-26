// analysis-orchestrator.ts — run lifecycle, retry, edit queueing, progress events.
// Calls analysis-service.runPhase() per phase. Does NOT call streamChat directly.
// Consolidates analysis-run-store state into module-level singleton.

import type { MethodologyPhase } from "../../shared/types/methodology";
import type {
  AnalysisEntity,
  AnalysisRelationship,
} from "../../shared/types/entity";
import type {
  AnalysisProgressEvent,
  PhaseSummary,
} from "../../shared/types/events";
import { getRuntimeErrorMessage } from "../../shared/types/runtime-error";
import type {
  AnalysisRuntimeOverrides,
  ResolvedAnalysisRuntime,
} from "../../shared/types/analysis-runtime";
import type { PhaseResult } from "../services/analysis-service";
import { runPhase } from "../services/analysis-service";
import {
  buildPhasePromptBundle,
  createRunPromptProvenance,
} from "../services/analysis-prompt-provenance";
import { buildPhaseBrief } from "../services/analysis-phase-brief";
import {
  SUPPORTED_ANALYSIS_PHASES,
  getCanonicalAnalysisPhaseIndex,
  normalizeRequestedActivePhases,
  type SupportedAnalysisPhase,
} from "../services/analysis-phase-selection";
import * as entityGraphService from "../services/entity-graph-service";
import * as revalidationService from "../services/revalidation-service";
import { commitPhaseSnapshot } from "../services/revision-diff";
import {
  getRecordedLoopbackTriggers,
  clearRecordedLoopbackTriggers,
} from "../services/analysis-tools";
import type { LoopbackTriggerType } from "../services/analysis-tools";
import { analysisRuntimeConfig } from "../config/analysis-runtime";
import { resolveAnalysisRuntime } from "../config/analysis-runtime-resolver";
import * as runtimeStatus from "../services/runtime-status";
import {
  clearProviderSessionBinding,
  getProviderSessionBinding,
  getWorkspaceDatabase,
  upsertProviderSessionBinding,
} from "../services/workspace";
import { createRunLogger, timer } from "../utils/ai-logger";
import type { RunLogger } from "../utils/ai-logger";
import type {
  RuntimeAdapter,
  RuntimeStructuredTurnInput,
} from "../services/ai/adapter-contract";
import { getRuntimeAdapter } from "../services/ai/adapter-contract";
import {
  synthesizeReport,
  SYNTHESIS_SYSTEM_PROMPT,
} from "../services/synthesis-service";
import type {
  AnyDomainEventInput,
  DomainEventInput,
} from "../services/workspace/domain-event-types";
import { nanoid } from "nanoid";
import type { RunSummaryState } from "../../shared/types/workspace-state";

// ── Types ──

export type FailureClass = "retryable" | "terminal";

export type RunStatusValue =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "interrupted";

export interface RunStatus {
  runId: string;
  status: RunStatusValue;
  activePhase: MethodologyPhase | null;
  phasesCompleted: number;
  totalPhases: number;
  error?: string;
}

export interface AnalysisResult {
  runId: string;
  entities: AnalysisEntity[];
  relationships: AnalysisRelationship[];
}

export interface RunPersistenceContext {
  workspaceId?: string;
  threadId?: string;
  commandId?: string;
  receiptId?: string;
  correlationId?: string;
  causationId?: string;
  producer?: string;
}

interface CommitSummary {
  entitiesCreated: number;
  entitiesUpdated: number;
  relationshipsCreated: number;
}

interface ActiveRun {
  runId: string;
  workspaceId: string;
  threadId: string;
  status: RunStatusValue;
  activePhase: MethodologyPhase | null;
  provider?: string;
  model?: string;
  runtime: ResolvedAnalysisRuntime;
  activePhases: SupportedPhase[];
  autoRevalidationEnabled: boolean;
  editQueue: Array<() => void>;
  startTime: number;
  phasesCompleted: MethodologyPhase[];
  phaseTurnCounts: Partial<Record<MethodologyPhase, number>>;
  activePhaseTurnId: string | null;
  abortController: AbortController;
  error?: string;
  logger: RunLogger;
  promptProvenance: ReturnType<typeof createRunPromptProvenance>;
}

function clearAnalysisRunBinding(
  run: Pick<ActiveRun, "runId" | "threadId">,
): void {
  clearProviderSessionBinding(run.threadId, {
    runId: run.runId,
    purpose: "analysis",
    expectedPurpose: "analysis",
    reason: "process_terminated",
  });
}

// ── Constants ──

type SupportedPhase = SupportedAnalysisPhase;

const SUPPORTED_PHASES: SupportedPhase[] = SUPPORTED_ANALYSIS_PHASES;

const MAX_RETRIES = analysisRuntimeConfig.orchestrator.maxRetries;
const MAX_LOOPBACK_PASSES =
  analysisRuntimeConfig.orchestrator.maxLoopbackPasses;

/** Maps loopback trigger types to the phase that needs re-running */
const TRIGGER_TARGET_PHASE: Record<LoopbackTriggerType, MethodologyPhase> = {
  new_player: "player-identification",
  objective_changed: "player-identification",
  new_game: "baseline-model",
  game_reframed: "baseline-model",
  repeated_dominates: "baseline-model",
  new_cross_game_link: "baseline-model",
  escalation_revision: "baseline-model",
  institutional_change: "baseline-model",
  assumption_invalidated: "assumptions",
  model_unexplained_fact: "baseline-model",
  behavioral_overlay_change: "baseline-model",
  meta_check_blind_spot: "player-identification",
};
const PHASE_TIMEOUT_MS = analysisRuntimeConfig.orchestrator.phaseTimeoutMs;
const RUN_TIMEOUT_MS = analysisRuntimeConfig.orchestrator.runTimeoutMs;

// ── Synthesis adapter ──

async function loadSynthesisAdapter(
  provider?: string,
): Promise<RuntimeAdapter> {
  if (process.env.GAME_THEORY_ANALYSIS_TEST_MODE === "1") {
    const mod = await import("../services/ai/test-adapter");
    return {
      provider: "claude",
      createSession(key) {
        return {
          provider: "claude",
          context: key,
          streamChatTurn: async function* () {
            throw new Error("Test adapter does not support chat turns");
          },
          runStructuredTurn<T = unknown>(input: RuntimeStructuredTurnInput) {
            return mod.runAnalysisPhase<T>(
              input.prompt,
              input.systemPrompt,
              input.model,
              input.schema,
              { signal: input.signal },
            );
          },
          getDiagnostics() {
            return {
              provider: "claude",
              sessionId: "test-synthesis-adapter",
              details: { threadId: key.threadId },
            };
          },
          getBinding() {
            return null;
          },
          async dispose() {},
        };
      },
      async listModels() {
        return [];
      },
      async checkHealth() {
        return {
          provider: "claude",
          status: "healthy",
          reason: null,
          checkedAt: Date.now(),
          checks: [],
        };
      },
    };
  }

  return getRuntimeAdapter(provider as "anthropic" | "openai" | undefined);
}

/** JSON Schema for synthesis structured output — mirrors analysisReportDataSchema */
const SYNTHESIS_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["analysis-report"] },
    executive_summary: { type: "string" },
    why: { type: "string" },
    key_evidence: { type: "array", items: { type: "string" } },
    open_assumptions: { type: "array", items: { type: "string" } },
    entity_references: {
      type: "array",
      items: {
        type: "object",
        properties: {
          entity_id: { type: "string" },
          display_name: { type: "string" },
        },
        required: ["entity_id", "display_name"],
        additionalProperties: false,
      },
    },
    prediction_verdict: {
      anyOf: [
        {
          type: "object",
          properties: {
            event_question: { type: "string" },
            predicted_probability: { type: "number" },
            market_probability: {
              anyOf: [{ type: "number" }, { type: "null" }],
            },
            price_as_of: { anyOf: [{ type: "string" }, { type: "null" }] },
            edge: { anyOf: [{ type: "number" }, { type: "null" }] },
            verdict: {
              anyOf: [
                { type: "string", enum: ["overpriced", "underpriced", "fair"] },
                { type: "null" },
              ],
            },
            bet_direction: {
              anyOf: [
                { type: "string", enum: ["yes", "no", "hold"] },
                { type: "null" },
              ],
            },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: [
            "event_question",
            "predicted_probability",
            "market_probability",
            "price_as_of",
            "edge",
            "verdict",
            "bet_direction",
            "confidence",
          ],
          additionalProperties: false,
        },
        { type: "null" },
      ],
    },
    what_would_change: { type: "array", items: { type: "string" } },
    source_url: { anyOf: [{ type: "string" }, { type: "null" }] },
    analysis_timestamp: { type: "string" },
  },
  required: [
    "type",
    "executive_summary",
    "why",
    "key_evidence",
    "open_assumptions",
    "entity_references",
    "prediction_verdict",
    "what_would_change",
    "source_url",
    "analysis_timestamp",
  ],
  additionalProperties: false,
};

// ── Module-level state ──

let activeRun: ActiveRun | null = null;
let runPromise: Promise<void> | null = null;
const progressListeners = new Set<(event: AnalysisProgressEvent) => void>();

/** Capped snapshot store: completed run results keyed by runId */
const MAX_RESULT_SNAPSHOTS =
  analysisRuntimeConfig.orchestrator.maxResultSnapshots;
const resultSnapshots = new Map<
  string,
  { entities: AnalysisEntity[]; relationships: AnalysisRelationship[] }
>();

// ── Progress event helpers ──

function emitProgress(event: AnalysisProgressEvent): void {
  for (const cb of progressListeners) {
    try {
      cb(event);
    } catch {
      // Listener errors must not break orchestrator flow
    }
  }
}

function emitPhaseActivity(
  runId: string,
  phase: MethodologyPhase,
  message: string,
  options?: {
    kind?: Extract<AnalysisProgressEvent, { type: "phase_activity" }>["kind"];
    toolName?: string;
    query?: string;
  },
): void {
  emitProgress({
    type: "phase_activity",
    phase,
    runId,
    kind: options?.kind ?? "note",
    message,
    ...(options?.toolName ? { toolName: options.toolName } : {}),
    ...(options?.query ? { query: options.query } : {}),
  });
}

function appendRunLifecycleEvents(
  run: Pick<ActiveRun, "runId" | "workspaceId" | "threadId">,
  producer: string,
  events: DomainEventInput[],
): void {
  getWorkspaceDatabase().eventStore.appendEvents(
    events.map(
      (event) =>
        ({
          ...event,
          workspaceId: run.workspaceId,
          threadId: run.threadId,
          runId: run.runId,
          producer,
        }) as AnyDomainEventInput,
    ),
  );
}

function nextPhaseTurn(
  run: ActiveRun,
  phase: MethodologyPhase,
): {
  phaseTurnId: string;
  turnIndex: number;
} {
  const turnIndex = (run.phaseTurnCounts[phase] ?? 0) + 1;
  run.phaseTurnCounts[phase] = turnIndex;
  return {
    phaseTurnId: `phase-turn-${nanoid()}`,
    turnIndex,
  };
}

function buildRunSummary(
  run: ActiveRun,
  statusMessage: string,
  failedPhase?: MethodologyPhase,
): RunSummaryState {
  return {
    statusMessage,
    failedPhase,
    completedPhases: run.phasesCompleted.length,
  };
}

// ── Retry classification ──

export function classifyFailure(error: string): FailureClass {
  // Only these specific patterns are retryable
  if (/connect|ECONNR|network|socket|EPIPE/i.test(error)) return "retryable"; // transport
  if (/^Codex turn failed:.*\babort(ed)?\b/i.test(error)) return "retryable"; // remote Codex aborts
  if (/empty.*(response|output)|no.*(content|output|text)/i.test(error))
    return "retryable"; // empty
  if (
    /schema.*refus|invalid_json_schema|response_format|outputSchema|not permitted/i.test(
      error,
    )
  ) {
    return "terminal"; // schema refusal / unsupported structured output
  }
  if (/parse|json|syntax|zod|validation/i.test(error)) return "retryable"; // parse
  // Everything else is terminal (timeout, auth, schema refusal, unknown)
  return "terminal";
}

// ── Edit queue ──

function drainEditQueue(): void {
  if (!activeRun) return;
  const queue = activeRun.editQueue.splice(0);
  if (queue.length > 0) {
    activeRun.logger.log("orchestrator", "edit-queue-drain", {
      count: queue.length,
    });
  }
  for (const mutation of queue) {
    try {
      mutation();
    } catch {
      // Edit errors must not break orchestrator flow
    }
  }
}

function syncAnalysisBindingPhaseTurn(run: ActiveRun): void {
  const binding = getProviderSessionBinding(run.threadId, "analysis");
  if (!binding || !run.activePhaseTurnId) {
    return;
  }

  upsertProviderSessionBinding({
    ...binding,
    runId: run.runId,
    phaseTurnId: run.activePhaseTurnId,
    updatedAt: Date.now(),
  });
}

function resolveLoopbackJumpIndex(
  phase: SupportedPhase,
  phaseIndex: number,
  run: ActiveRun,
  triggers: Array<{
    trigger_type: LoopbackTriggerType;
    justification: string;
    timestamp: number;
  }>,
): number | null {
  let earliestJumpIndex = Number.POSITIVE_INFINITY;

  for (const trigger of triggers) {
    const targetPhase = TRIGGER_TARGET_PHASE[trigger.trigger_type];
    const targetCanonicalIndex = getCanonicalAnalysisPhaseIndex(targetPhase);

    if (targetCanonicalIndex === -1) {
      continue;
    }

    const directActiveIndex = run.activePhases.findIndex(
      (activePhase) => activePhase === targetPhase,
    );

    if (directActiveIndex !== -1) {
      if (
        directActiveIndex < phaseIndex &&
        directActiveIndex < earliestJumpIndex
      ) {
        earliestJumpIndex = directActiveIndex;
      }
      continue;
    }

    const resolvedActiveIndex = run.activePhases.findIndex(
      (activePhase, activeIndex) =>
        activeIndex < phaseIndex &&
        getCanonicalAnalysisPhaseIndex(activePhase) >= targetCanonicalIndex,
    );

    if (resolvedActiveIndex !== -1) {
      if (resolvedActiveIndex < earliestJumpIndex) {
        earliestJumpIndex = resolvedActiveIndex;
      }
      continue;
    }

    run.logger.warn("orchestrator", "loopback-no-active-target", {
      from: phase,
      triggerType: trigger.trigger_type,
      targetPhase,
      justification: trigger.justification,
      activePhases: run.activePhases,
    });
  }

  return Number.isFinite(earliestJumpIndex) ? earliestJumpIndex : null;
}

// ── Single phase execution with retries ──

async function executeSinglePhase(
  phase: SupportedPhase,
  topic: string,
  run: ActiveRun,
  externalSignal?: AbortSignal,
): Promise<{ success: boolean; error?: string }> {
  const phaseStart = Date.now();

  // Check run-level timeout
  if (Date.now() - run.startTime >= RUN_TIMEOUT_MS) {
    return { success: false, error: "Run-level timeout exceeded" };
  }

  // Check external abort
  if (externalSignal?.aborted) {
    return { success: false, error: "Aborted" };
  }

  run.activePhase = phase;
  runtimeStatus.setActivePhase(run.runId, phase);
  entityGraphService.setPhaseStatus(phase, "running");
  const phaseBrief = buildPhaseBrief({
    phase,
    topic,
    completedPhases: run.phasesCompleted,
    activePhases: run.activePhases,
  });
  const { phaseTurnId, turnIndex } = nextPhaseTurn(run, phase);
  run.activePhaseTurnId = phaseTurnId;
  syncAnalysisBindingPhaseTurn(run);
  const phasePromptBundle = buildPhasePromptBundle({
    phase,
    topic,
    phaseBrief: phaseBrief.phaseBrief,
    effortLevel: run.runtime.effortLevel,
  });
  appendRunLifecycleEvents(run, "analysis-agent", [
    {
      type: "phase.started",
      payload: {
        phase,
        phaseTurnId,
        turnIndex,
        promptProvenance: phasePromptBundle.promptProvenance,
      },
      occurredAt: phaseStart,
    },
    {
      type: "run.status.changed",
      payload: {
        status: "running",
        activePhase: phase,
        progress: {
          completed: run.phasesCompleted.length,
          total: run.activePhases.length,
        },
        summary: buildRunSummary(run, `Running ${phase}`),
        latestPhaseTurnId: phaseTurnId,
      },
      occurredAt: phaseStart,
    },
  ]);
  emitProgress({ type: "phase_started", phase, runId: run.runId });
  run.logger.log("orchestrator", "phase-start", { phase, phaseTurnId });

  let lastError = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Check abort before each attempt
    if (externalSignal?.aborted) {
      entityGraphService.setPhaseStatus(phase, "pending");
      return { success: false, error: "Aborted" };
    }

    // Check run-level timeout before each attempt
    if (Date.now() - run.startTime >= RUN_TIMEOUT_MS) {
      run.logger.error("orchestrator", "run-timeout", {
        elapsedMs: Date.now() - run.startTime,
        phase,
        phaseTurnId,
      });
      entityGraphService.setPhaseStatus(phase, "failed");
      return { success: false, error: "Run-level timeout exceeded" };
    }

    run.logger.log("orchestrator", "attempt-start", {
      phase,
      phaseTurnId,
      attempt: attempt + 1,
      maxAttempts: MAX_RETRIES + 1,
    });

    // Per-phase timeout via AbortController
    const phaseAbort = new AbortController();
    let phaseTimer: ReturnType<typeof setTimeout> | null = null;
    const phaseTimeoutPromise = new Promise<PhaseResult>((_, reject) => {
      phaseTimer = setTimeout(() => {
        phaseAbort.abort();
        reject(new Error("Phase timeout"));
      }, PHASE_TIMEOUT_MS);
    });

    // Also abort if external signal fires
    const onExternalAbort = () => phaseAbort.abort();
    externalSignal?.addEventListener("abort", onExternalAbort, { once: true });

    let result: PhaseResult;
    try {
      result = await Promise.race([
        runPhase(phase, topic, {
          workspaceId: run.workspaceId,
          threadId: run.threadId,
          phaseBrief: phaseBrief.phaseBrief,
          promptBundle: {
            system: phasePromptBundle.system,
            user: phasePromptBundle.user,
            toolPolicy: phasePromptBundle.toolPolicy,
          },
          provider: run.provider,
          model: run.model,
          runtime: run.runtime,
          runId: run.runId,
          phaseTurnId,
          signal: phaseAbort.signal,
          logger: run.logger,
          onActivity: (activity) => {
            appendRunLifecycleEvents(run, "analysis-agent", [
              {
                type: "phase.activity.recorded",
                payload: {
                  phase,
                  phaseTurnId,
                  kind: activity.kind,
                  message: activity.message,
                  ...(activity.toolName ? { toolName: activity.toolName } : {}),
                  ...(activity.query ? { query: activity.query } : {}),
                },
                occurredAt: Date.now(),
              },
            ]);
            emitPhaseActivity(run.runId, phase, activity.message, {
              kind: activity.kind,
              toolName: activity.toolName,
              query: activity.query,
            });
          },
        }),
        phaseTimeoutPromise,
      ]);
    } catch (err) {
      if (phaseTimer) clearTimeout(phaseTimer);
      externalSignal?.removeEventListener("abort", onExternalAbort);

      if (externalSignal?.aborted) {
        entityGraphService.setPhaseStatus(phase, "pending");
        return { success: false, error: "Aborted" };
      }

      lastError = err instanceof Error ? err.message : String(err);
      const classification = classifyFailure(lastError);
      if (classification === "terminal") {
        run.logger.error("orchestrator", "phase-failed", {
          phase,
          phaseTurnId,
          elapsedMs: Date.now() - phaseStart,
          failureKind: classification,
          lastError,
        });
        entityGraphService.setPhaseStatus(phase, "failed");
        return { success: false, error: lastError };
      }
      run.logger.warn("orchestrator", "attempt-failed", {
        phase,
        phaseTurnId,
        attempt: attempt + 1,
        error: lastError,
        classification,
      });
      if (attempt < MAX_RETRIES) {
        emitPhaseActivity(
          run.runId,
          phase,
          "Retrying phase after validation/transport issue",
        );
      }
      continue;
    } finally {
      if (phaseTimer) clearTimeout(phaseTimer);
      externalSignal?.removeEventListener("abort", onExternalAbort);
    }

    if (result.success) {
      let commitSummary: CommitSummary | null = null;
      lastError = "";
      try {
        let commitResult = commitPhaseSnapshot({
          phase,
          runId: run.runId,
          entities: result.entities,
          relationships: result.relationships,
        });

        if (commitResult.status === "retry_required") {
          run.logger.warn("orchestrator", "truncation-retry", {
            phase,
            phaseTurnId,
            originalAiEntityCount: commitResult.originalAiEntityCount,
            returnedAiEntityCount: commitResult.returnedAiEntityCount,
          });
          emitPhaseActivity(
            run.runId,
            phase,
            "Retrying phase after validation/transport issue",
          );

          const retryPromptBundle = buildPhasePromptBundle({
            phase,
            topic,
            phaseBrief: phaseBrief.phaseBrief,
            revisionRetryInstruction: commitResult.retryMessage,
            effortLevel: run.runtime.effortLevel,
          });
          appendRunLifecycleEvents(run, "analysis-agent", [
            {
              type: "phase.started",
              payload: {
                phase,
                phaseTurnId,
                turnIndex,
                promptProvenance: retryPromptBundle.promptProvenance,
              },
              occurredAt: Date.now(),
            },
            {
              type: "run.status.changed",
              payload: {
                status: "running",
                activePhase: phase,
                progress: {
                  completed: run.phasesCompleted.length,
                  total: run.activePhases.length,
                },
                summary: buildRunSummary(run, `Retrying ${phase}`),
                latestPhaseTurnId: phaseTurnId,
              },
              occurredAt: Date.now(),
            },
          ]);

          const retryResult = await Promise.race([
            runPhase(phase, topic, {
              workspaceId: run.workspaceId,
              threadId: run.threadId,
              phaseBrief: phaseBrief.phaseBrief,
              promptBundle: {
                system: retryPromptBundle.system,
                user: retryPromptBundle.user,
                toolPolicy: retryPromptBundle.toolPolicy,
              },
              revisionRetryInstruction: commitResult.retryMessage,
              provider: run.provider,
              model: run.model,
              runtime: run.runtime,
              runId: run.runId,
              phaseTurnId,
              signal: phaseAbort.signal,
              logger: run.logger,
              onActivity: (activity) => {
                appendRunLifecycleEvents(run, "analysis-agent", [
                  {
                    type: "phase.activity.recorded",
                    payload: {
                      phase,
                      phaseTurnId,
                      kind: activity.kind,
                      message: activity.message,
                      ...(activity.toolName
                        ? { toolName: activity.toolName }
                        : {}),
                      ...(activity.query ? { query: activity.query } : {}),
                    },
                    occurredAt: Date.now(),
                  },
                ]);
                emitPhaseActivity(run.runId, phase, activity.message, {
                  kind: activity.kind,
                  toolName: activity.toolName,
                  query: activity.query,
                });
              },
            }),
            phaseTimeoutPromise,
          ]);

          if (!retryResult.success) {
            result = retryResult;
          } else {
            commitResult = commitPhaseSnapshot({
              phase,
              runId: run.runId,
              entities: retryResult.entities,
              relationships: retryResult.relationships,
              allowLargeReductionCommit: true,
            });

            if (commitResult.status !== "applied") {
              throw new Error(
                "Revision diff requested an unexpected second truncation retry",
              );
            }

            result = retryResult;
          }
        }

        if (!result.success) {
          lastError = result.error ?? "Unknown validation error";
        } else {
          if (commitResult.status !== "applied") {
            throw new Error("Revision diff did not produce an applied result");
          }

          commitSummary = {
            entitiesCreated: commitResult.summary.entitiesCreated,
            entitiesUpdated: commitResult.summary.entitiesUpdated,
            relationshipsCreated: commitResult.summary.relationshipsCreated,
          };
        }
      } catch (err) {
        lastError = `Revision diff validation error: ${
          err instanceof Error ? err.message : String(err)
        }`;
      }

      if (!result.success || lastError) {
        const classification = classifyFailure(lastError);
        if (classification === "terminal") {
          run.logger.error("orchestrator", "phase-failed", {
            phase,
            phaseTurnId,
            elapsedMs: Date.now() - phaseStart,
            failureKind: classification,
            lastError,
          });
          entityGraphService.setPhaseStatus(phase, "failed");
          return { success: false, error: lastError };
        }
        run.logger.warn("orchestrator", "attempt-failed", {
          phase,
          phaseTurnId,
          attempt: attempt + 1,
          error: lastError,
          classification,
        });
        if (attempt < MAX_RETRIES) {
          emitPhaseActivity(
            run.runId,
            phase,
            "Retrying phase after validation/transport issue",
          );
        }
        lastError = "";
        continue;
      }

      entityGraphService.setPhaseStatus(phase, "complete");

      run.logger.log("orchestrator", "phase-complete", {
        phase,
        phaseTurnId,
        elapsedMs: Date.now() - phaseStart,
        entities: result.entities.length,
        relationships: result.relationships.length,
        attemptsUsed: attempt + 1,
      });
      await run.logger.flush();

      const summary: PhaseSummary = {
        entitiesCreated: commitSummary!.entitiesCreated,
        relationshipsCreated: commitSummary!.relationshipsCreated,
        entitiesUpdated: commitSummary!.entitiesUpdated,
        durationMs: Date.now() - phaseStart,
      };
      appendRunLifecycleEvents(run, "analysis-agent", [
        {
          type: "phase.completed",
          payload: {
            phase,
            phaseTurnId,
            summary,
          },
          occurredAt: Date.now(),
        },
        {
          type: "run.status.changed",
          payload: {
            status: "running",
            activePhase: null,
            progress: {
              completed: run.phasesCompleted.length + 1,
              total: run.activePhases.length,
            },
            summary: {
              statusMessage: `Completed ${phase}`,
              completedPhases: run.phasesCompleted.length + 1,
            },
            latestPhaseTurnId: phaseTurnId,
          },
          occurredAt: Date.now(),
        },
      ]);
      emitProgress({
        type: "phase_completed",
        phase,
        runId: run.runId,
        summary,
      });
      runtimeStatus.completePhase(run.runId);

      // Drain edit queue after each successful phase
      drainEditQueue();

      return { success: true };
    }

    // Parse/validation failure — check classification
    lastError = result.error ?? "Unknown validation error";
    const classification = classifyFailure(lastError);
    if (classification === "terminal") {
      run.logger.error("orchestrator", "phase-failed", {
        phase,
        phaseTurnId,
        elapsedMs: Date.now() - phaseStart,
        failureKind: classification,
        lastError,
      });
      entityGraphService.setPhaseStatus(phase, "failed");
      return { success: false, error: lastError };
    }
    run.logger.warn("orchestrator", "attempt-failed", {
      phase,
      phaseTurnId,
      attempt: attempt + 1,
      error: lastError,
      classification,
    });
    if (attempt < MAX_RETRIES) {
      emitPhaseActivity(
        run.runId,
        phase,
        "Retrying phase after validation/transport issue",
      );
    }
    // Retryable — continue loop
  }

  // Exhausted retries
  run.logger.error("orchestrator", "phase-failed", {
    phase,
    phaseTurnId,
    elapsedMs: Date.now() - phaseStart,
    failureKind: "retries-exhausted",
    lastError,
  });
  entityGraphService.setPhaseStatus(phase, "failed");
  return { success: false, error: lastError };
}

// ── Public API ──

export async function runFull(
  topic: string,
  provider?: string,
  model?: string,
  signal?: AbortSignal,
  runtimeOverrides?: AnalysisRuntimeOverrides,
  persistenceContext: RunPersistenceContext = {},
): Promise<{ runId: string; workspaceId: string; threadId: string }> {
  // Guard: check both status AND whether the async execution is still unwinding
  if (activeRun && activeRun.status === "running") {
    throw new Error("A run is already active");
  }
  if (runPromise !== null) {
    throw new Error("A run is already active");
  }

  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const analysisTimer = timer();
  const abortController = new AbortController();
  const runtime = resolveAnalysisRuntime(runtimeOverrides);
  const activePhases = normalizeRequestedActivePhases(
    runtimeOverrides?.activePhases,
  );
  const promptProvenance = createRunPromptProvenance(activePhases);
  const autoRevalidationEnabled =
    activePhases.length === SUPPORTED_PHASES.length;
  const workspaceDatabase = getWorkspaceDatabase();
  const runOccurredAt = Date.now();
  const resolvedThreadContext =
    workspaceDatabase.eventStore.resolveThreadContext({
      workspaceId: persistenceContext.workspaceId,
      threadId: persistenceContext.threadId,
      producer: persistenceContext.producer ?? "analysis-agent",
      commandId: persistenceContext.commandId,
      receiptId: persistenceContext.receiptId,
      correlationId: persistenceContext.correlationId,
      causationId: persistenceContext.causationId,
      occurredAt: runOccurredAt,
    });
  const logger = createRunLogger(runId, {
    workspaceId: resolvedThreadContext.workspaceId,
    threadId: resolvedThreadContext.threadId,
  });

  if (
    !runtimeStatus.acquireRun("analysis", runId, {
      totalPhases: activePhases.length,
    })
  ) {
    throw new Error("A run is already active");
  }

  // Use an explicit timeout controller so runtime behavior is testable with fake timers.
  const runTimeoutController = new AbortController();
  const runTimeoutHandle = setTimeout(
    () => runTimeoutController.abort(),
    RUN_TIMEOUT_MS,
  );
  const runTimeoutSignal = runTimeoutController.signal;

  // Combine all abort sources: user signal, run timeout, internal controller
  const signals: AbortSignal[] = [abortController.signal, runTimeoutSignal];
  if (signal) signals.push(signal);
  const combinedSignal = AbortSignal.any(signals);

  // When combined signal fires, propagate to internal controller
  combinedSignal.addEventListener(
    "abort",
    () => {
      if (!abortController.signal.aborted) abortController.abort();
    },
    { once: true },
  );

  activeRun = {
    runId,
    workspaceId: resolvedThreadContext.workspaceId,
    threadId: resolvedThreadContext.threadId,
    status: "running",
    activePhase: null,
    provider,
    model,
    runtime,
    activePhases,
    autoRevalidationEnabled,
    editQueue: [],
    startTime: Date.now(),
    phasesCompleted: [],
    phaseTurnCounts: {},
    activePhaseTurnId: null,
    abortController,
    logger,
    promptProvenance,
  };

  try {
    workspaceDatabase.eventStore.appendEvents([
      ...(resolvedThreadContext.createdThreadEvent
        ? [resolvedThreadContext.createdThreadEvent]
        : []),
      {
        type: "run.created",
        workspaceId: resolvedThreadContext.workspaceId,
        threadId: resolvedThreadContext.threadId,
        runId,
        payload: {
          kind: "analysis",
          provider: provider ?? null,
          model: model ?? null,
          effort: runtime.effortLevel,
          status: "running",
          startedAt: runOccurredAt,
          totalPhases: activePhases.length,
          promptProvenance,
          logCorrelation: {
            logFileName: `${runId}.jsonl`,
          },
        },
        commandId: persistenceContext.commandId,
        receiptId: persistenceContext.receiptId,
        correlationId: persistenceContext.correlationId,
        causationId: persistenceContext.causationId,
        occurredAt: runOccurredAt,
        producer: persistenceContext.producer ?? "analysis-agent",
      },
      {
        type: "run.status.changed",
        workspaceId: resolvedThreadContext.workspaceId,
        threadId: resolvedThreadContext.threadId,
        runId,
        payload: {
          status: "running",
          activePhase: null,
          progress: {
            completed: 0,
            total: activePhases.length,
          },
          summary: {
            statusMessage: "Run started",
            completedPhases: 0,
          },
        },
        commandId: persistenceContext.commandId,
        receiptId: persistenceContext.receiptId,
        correlationId: persistenceContext.correlationId,
        causationId: persistenceContext.causationId,
        occurredAt: runOccurredAt,
        producer: persistenceContext.producer ?? "analysis-agent",
      },
    ]);
  } catch (error) {
    activeRun = null;
    clearTimeout(runTimeoutHandle);
    runtimeStatus.releaseRun(runId, "failed", {
      failureMessage:
        error instanceof Error ? error.message : "Failed to persist run start",
      provider: provider as "anthropic" | "openai" | undefined,
    });
    throw error;
  }

  // Reset the graph only after the run lock is held so losing concurrent
  // requests cannot wipe the canvas before acquireRun rejects them.
  entityGraphService.newAnalysis(topic);

  logger.log("orchestrator", "analysis-start", {
    mode: "analysis",
    topic,
    model,
    provider,
    runtime,
    activePhases,
    autoRevalidationEnabled,
    phases: activePhases.length,
  });

  // Execute phases async — don't await here, return immediately
  const run = activeRun;
  const executeAsync = async () => {
    try {
      let phaseIndex = 0;
      let passCount = 0;

      while (phaseIndex < run.activePhases.length) {
        if (run.status !== "running") break;

        const phase = run.activePhases[phaseIndex];

        const result = await executeSinglePhase(
          phase,
          topic,
          run,
          combinedSignal,
        );

        if (!result.success) {
          if (combinedSignal.aborted || result.error === "Aborted") {
            // Distinguish run-level timeout from user abort
            if (runTimeoutSignal.aborted && !signal?.aborted) {
              run.status = "failed";
              run.error = "Run-level timeout exceeded";
              const finishedAt = Date.now();
              const failure = runtimeStatus.inferRuntimeError(
                "Run-level timeout exceeded",
                run.provider as "anthropic" | "openai" | undefined,
              );
              appendRunLifecycleEvents(run, "analysis-agent", [
                {
                  type: "run.failed",
                  payload: {
                    activePhase: phase,
                    latestPhaseTurnId: run.activePhaseTurnId ?? undefined,
                    failedPhase: phase,
                    error: failure,
                    finishedAt,
                    summary: buildRunSummary(
                      run,
                      "Run-level timeout exceeded",
                      phase,
                    ),
                  },
                  occurredAt: finishedAt,
                },
                {
                  type: "run.status.changed",
                  payload: {
                    status: "failed",
                    activePhase: phase,
                    progress: {
                      completed: run.phasesCompleted.length,
                      total: run.activePhases.length,
                    },
                    failedPhase: phase,
                    failure,
                    finishedAt,
                    summary: buildRunSummary(
                      run,
                      "Run-level timeout exceeded",
                      phase,
                    ),
                    latestPhaseTurnId: run.activePhaseTurnId ?? undefined,
                  },
                  occurredAt: finishedAt,
                },
              ]);
              runtimeStatus.releaseRun(run.runId, "failed", {
                failedPhase: phase,
                failureMessage: run.error,
                provider: run.provider as "anthropic" | "openai" | undefined,
              });
              run.logger.error("orchestrator", "run-timeout", {
                elapsedMs: analysisTimer.elapsed(),
                phase,
              });
              emitProgress({
                type: "analysis_failed",
                runId: run.runId,
                error: failure,
              });
            } else {
              run.status = "interrupted";
              run.error = "Run was aborted";
              const finishedAt = Date.now();
              appendRunLifecycleEvents(run, "analysis-agent", [
                {
                  type: "run.cancelled",
                  payload: {
                    activePhase: phase,
                    latestPhaseTurnId: run.activePhaseTurnId ?? undefined,
                    finishedAt,
                    summary: buildRunSummary(run, "Run was aborted"),
                  },
                  occurredAt: finishedAt,
                },
                {
                  type: "run.status.changed",
                  payload: {
                    status: "cancelled",
                    activePhase: phase,
                    progress: {
                      completed: run.phasesCompleted.length,
                      total: run.activePhases.length,
                    },
                    finishedAt,
                    summary: buildRunSummary(run, "Run was aborted"),
                    latestPhaseTurnId: run.activePhaseTurnId ?? undefined,
                  },
                  occurredAt: finishedAt,
                },
              ]);
              runtimeStatus.releaseRun(run.runId, "cancelled");
              run.logger.warn("orchestrator", "analysis-aborted", {
                phasesCompleted: run.phasesCompleted.length,
              });
            }
          } else {
            run.status = "failed";
            run.error = result.error;
            const finishedAt = Date.now();
            const failure = runtimeStatus.inferRuntimeError(
              result.error ?? "Unknown error",
              run.provider as "anthropic" | "openai" | undefined,
            );
            appendRunLifecycleEvents(run, "analysis-agent", [
              {
                type: "run.failed",
                payload: {
                  activePhase: phase,
                  latestPhaseTurnId: run.activePhaseTurnId ?? undefined,
                  failedPhase: phase,
                  error: failure,
                  finishedAt,
                  summary: buildRunSummary(
                    run,
                    result.error ?? "Unknown error",
                    phase,
                  ),
                },
                occurredAt: finishedAt,
              },
              {
                type: "run.status.changed",
                payload: {
                  status: "failed",
                  activePhase: phase,
                  progress: {
                    completed: run.phasesCompleted.length,
                    total: run.activePhases.length,
                  },
                  failedPhase: phase,
                  failure,
                  finishedAt,
                  summary: buildRunSummary(
                    run,
                    result.error ?? "Unknown error",
                    phase,
                  ),
                  latestPhaseTurnId: run.activePhaseTurnId ?? undefined,
                },
                occurredAt: finishedAt,
              },
            ]);
            runtimeStatus.releaseRun(run.runId, "failed", {
              failedPhase: phase,
              failureMessage: run.error,
              provider: run.provider as "anthropic" | "openai" | undefined,
            });
            emitProgress({
              type: "analysis_failed",
              runId: run.runId,
              error: failure,
            });
          }
          break;
        }

        if (!run.phasesCompleted.includes(phase)) {
          run.phasesCompleted.push(phase);
        }

        // Check for loopback triggers after each phase
        const triggers = getRecordedLoopbackTriggers(run.runId);
        if (triggers.length > 0) {
          clearRecordedLoopbackTriggers(run.runId);

          const earliestTargetIndex = resolveLoopbackJumpIndex(
            phase,
            phaseIndex,
            run,
            triggers,
          );

          if (
            earliestTargetIndex !== null &&
            earliestTargetIndex < phaseIndex
          ) {
            passCount++;

            if (passCount >= MAX_LOOPBACK_PASSES) {
              run.logger.error("orchestrator", "loopback-divergence", {
                passCount,
                triggers: triggers.map((t) => t.trigger_type),
              });
              run.status = "failed";
              run.error = `Loopback convergence failed after ${passCount} passes`;
              const finishedAt = Date.now();
              const failure = runtimeStatus.inferRuntimeError(
                run.error,
                run.provider as "anthropic" | "openai" | undefined,
              );
              appendRunLifecycleEvents(run, "analysis-agent", [
                {
                  type: "run.failed",
                  payload: {
                    activePhase: phase,
                    latestPhaseTurnId: run.activePhaseTurnId ?? undefined,
                    failedPhase: phase,
                    error: failure,
                    finishedAt,
                    summary: buildRunSummary(run, run.error, phase),
                  },
                  occurredAt: finishedAt,
                },
                {
                  type: "run.status.changed",
                  payload: {
                    status: "failed",
                    activePhase: phase,
                    progress: {
                      completed: run.phasesCompleted.length,
                      total: run.activePhases.length,
                    },
                    failedPhase: phase,
                    failure,
                    finishedAt,
                    summary: buildRunSummary(run, run.error, phase),
                    latestPhaseTurnId: run.activePhaseTurnId ?? undefined,
                  },
                  occurredAt: finishedAt,
                },
              ]);
              runtimeStatus.releaseRun(run.runId, "failed", {
                failedPhase: phase,
                failureMessage: run.error,
                provider: run.provider as "anthropic" | "openai" | undefined,
              });
              emitProgress({
                type: "analysis_failed",
                runId: run.runId,
                error: failure,
              });
              break;
            }

            run.logger.log("orchestrator", "loopback-jump", {
              from: phase,
              to: run.activePhases[earliestTargetIndex],
              pass: passCount,
              triggers: triggers.map((t) => ({
                type: t.trigger_type,
                justification: t.justification,
              })),
            });

            phaseIndex = earliestTargetIndex;
            continue;
          }
        }

        phaseIndex++;
      }

      if (run.status === "running") {
        run.status = "completed";
        run.activePhase = null;
        const finishedAt = Date.now();
        appendRunLifecycleEvents(run, "analysis-agent", [
          {
            type: "run.completed",
            payload: {
              finishedAt,
              summary: buildRunSummary(run, "Run completed"),
              latestPhaseTurnId: run.activePhaseTurnId ?? undefined,
            },
            occurredAt: finishedAt,
          },
          {
            type: "run.status.changed",
            payload: {
              status: "completed",
              activePhase: null,
              progress: {
                completed: run.phasesCompleted.length,
                total: run.activePhases.length,
              },
              finishedAt,
              summary: buildRunSummary(run, "Run completed"),
              latestPhaseTurnId: run.activePhaseTurnId ?? undefined,
            },
            occurredAt: finishedAt,
          },
        ]);

        const snapshot2 = entityGraphService.getAnalysis();
        run.logger.log("orchestrator", "analysis-finished", {
          status: "success",
          phasesCompleted: run.phasesCompleted.length,
          totalEntities: snapshot2.entities.length,
          elapsedMs: analysisTimer.elapsed(),
        });

        // Snapshot the result so getResult(runId) returns point-in-time data
        const snapshot = entityGraphService.getAnalysis();
        if (resultSnapshots.size >= MAX_RESULT_SNAPSHOTS) {
          // Evict oldest entry
          const oldestKey = resultSnapshots.keys().next().value;
          if (oldestKey !== undefined) resultSnapshots.delete(oldestKey);
        }
        resultSnapshots.set(run.runId, {
          entities: [...snapshot.entities],
          relationships: [...snapshot.relationships],
        });

        emitProgress({ type: "analysis_completed", runId: run.runId });

        // Trigger synthesis report generation
        emitProgress({ type: "synthesis_started", runId: run.runId });
        try {
          const adapter = await loadSynthesisAdapter(run.provider);
          const model = run.model ?? "claude-sonnet-4-20250514";
          await synthesizeReport({
            runId: run.runId,
            aiCaller: async (graphSummary: string) => {
              const session = adapter.createSession({
                workspaceId: run.workspaceId,
                threadId: run.threadId,
                runId: run.runId,
                purpose: "analysis",
              });
              try {
                return await session.runStructuredTurn({
                  prompt: graphSummary,
                  systemPrompt: SYNTHESIS_SYSTEM_PROMPT,
                  model,
                  schema: SYNTHESIS_OUTPUT_SCHEMA,
                  runId: run.runId,
                  webSearch: false,
                });
              } finally {
                await session.dispose();
              }
            },
          });
          emitProgress({ type: "synthesis_completed", runId: run.runId });
        } catch (err) {
          run.logger.log("orchestrator", "synthesis-failed", {
            error: err instanceof Error ? err.message : String(err),
          });
          // Synthesis failure does not affect run completion
        }

        runtimeStatus.releaseRun(run.runId, "completed");
      } else {
        // Run ended with failure or interruption — log the terminal event
        run.logger.log("orchestrator", "analysis-finished", {
          status: run.status,
          phasesCompleted: run.phasesCompleted.length,
          error: run.error,
          elapsedMs: analysisTimer.elapsed(),
        });
      }
    } finally {
      clearTimeout(runTimeoutHandle);
      // Drain any remaining queued edits
      drainEditQueue();
      run.activePhase = null;
      if (run.status !== "running") {
        clearAnalysisRunBinding(run);
      }
      // Flush logger before clearing run state
      try {
        await run.logger.flush();
      } catch {
        // Logger flush must not prevent cleanup
      }
      // Clear runPromise so new runs can start
      runPromise = null;
      // Flush deferred revalidations that were suppressed during this run
      revalidationService.onRunComplete(
        run.provider,
        run.model,
        run.runtime,
        run.autoRevalidationEnabled,
      );
    }
  };

  // Track the async execution so concurrent run guard works
  runPromise = executeAsync();

  return {
    runId,
    workspaceId: resolvedThreadContext.workspaceId,
    threadId: resolvedThreadContext.threadId,
  };
}

function getTerminalRuntimeStatus(runId: string): RunStatus | null {
  const snapshot = runtimeStatus.getSnapshot();
  if (snapshot.kind !== "analysis" || snapshot.runId !== runId) {
    return null;
  }

  if (snapshot.status !== "failed" && snapshot.status !== "cancelled") {
    return null;
  }

  return {
    runId,
    status: snapshot.status === "cancelled" ? "interrupted" : "failed",
    activePhase: snapshot.activePhase,
    phasesCompleted: snapshot.progress.completed,
    totalPhases: snapshot.progress.total,
    error: getRuntimeErrorMessage(snapshot.failure),
  };
}

export function getStatus(runId: string): RunStatus {
  if (!activeRun || activeRun.runId !== runId) {
    const terminalStatus = getTerminalRuntimeStatus(runId);
    if (terminalStatus) {
      return terminalStatus;
    }

    return {
      runId,
      status: "idle",
      activePhase: null,
      phasesCompleted: 0,
      totalPhases: SUPPORTED_PHASES.length,
    };
  }

  return {
    runId: activeRun.runId,
    status: activeRun.status,
    activePhase: activeRun.activePhase,
    phasesCompleted: activeRun.phasesCompleted.length,
    totalPhases: activeRun.activePhases.length,
    error: activeRun.error,
  };
}

export function getActiveStatus(): RunStatus | null {
  if (!activeRun || activeRun.status !== "running") {
    return null;
  }

  return {
    runId: activeRun.runId,
    status: activeRun.status,
    activePhase: activeRun.activePhase,
    phasesCompleted: activeRun.phasesCompleted.length,
    totalPhases: activeRun.activePhases.length,
    error: activeRun.error,
  };
}

export function getResult(runId: string): AnalysisResult {
  // Return snapshot if available (completed run), otherwise fall back to current graph
  const snapshot = resultSnapshots.get(runId);
  if (snapshot) {
    return {
      runId,
      entities: snapshot.entities,
      relationships: snapshot.relationships,
    };
  }
  const analysis = entityGraphService.getAnalysis();
  return {
    runId,
    entities: analysis.entities,
    relationships: analysis.relationships,
  };
}

export function isRunning(): boolean {
  return (
    (activeRun !== null && activeRun.status === "running") ||
    runPromise !== null
  );
}

export function abort(): void {
  if (!activeRun || activeRun.status !== "running") return;
  activeRun.status = "interrupted";
  activeRun.error = "Run was aborted";
  activeRun.abortController.abort();
}

export function queueEdit(mutation: () => void): void {
  if (!activeRun || activeRun.status !== "running") {
    // No active run — execute immediately
    mutation();
    return;
  }
  activeRun.editQueue.push(mutation);
}

export function onProgress(
  callback: (event: AnalysisProgressEvent) => void,
): () => void {
  progressListeners.add(callback);
  return () => {
    progressListeners.delete(callback);
  };
}

// ── Orphan detection ──

export function markOrphanedRunsFailed(): void {
  if (activeRun && activeRun.status === "running") {
    const runId = activeRun.runId;
    clearAnalysisRunBinding(activeRun);
    activeRun.status = "failed";
    activeRun.error = "Run interrupted (app restart)";
    activeRun.activePhase = null;
    runtimeStatus.releaseRun(runId, "failed", {
      failureMessage: activeRun.error,
      provider: activeRun.provider as "anthropic" | "openai" | undefined,
    });
    activeRun = null;
    runPromise = null;
  }
}

// ── Testing ──

/** Reset all module state. Only for use in tests. */
export function _resetForTest(): void {
  activeRun = null;
  runPromise = null;
  progressListeners.clear();
  resultSnapshots.clear();
  runtimeStatus._resetForTest();
}

/** Expose activeRun for test assertions. */
export function _getActiveRun(): ActiveRun | null {
  return activeRun;
}

/** Expose runPromise for test assertions. */
export function _getRunPromise(): Promise<void> | null {
  return runPromise;
}
