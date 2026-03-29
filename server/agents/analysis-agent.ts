// analysis-orchestrator.ts — run lifecycle, retry, edit queueing, progress events.
// Executes durable analysis phase turns through the shared phase-turn service.
// Consolidates analysis-run-store state into module-level singleton.

import type { MethodologyPhase } from "../../shared/types/methodology";
import type {
  AnalysisEntity,
  AnalysisRelationship,
} from "../../shared/types/entity";
import type {
  AnalysisProgressEvent,
} from "../../shared/types/events";
import type { PhaseTurnSummaryState } from "../../shared/types/workspace-state";
import { getRuntimeErrorMessage } from "../../shared/types/runtime-error";
import type {
  AnalysisRuntimeOverrides,
  ResolvedAnalysisRuntime,
  RuntimeProvider,
} from "../../shared/types/analysis-runtime";
import { normalizeRuntimeProvider } from "../../shared/types/analysis-runtime";
import { executePhaseTurn } from "../services/analysis-phase-turn-service";
import {
  createRunPromptProvenance,
} from "../services/analysis-prompt-provenance";
import {
  SUPPORTED_ANALYSIS_PHASES,
  getCanonicalAnalysisPhaseIndex,
  normalizeRequestedActivePhases,
  type SupportedAnalysisPhase,
} from "../services/analysis-phase-selection";
import * as entityGraphService from "../services/entity-graph-service";
import * as revalidationService from "../services/revalidation-service";
import {
  getRecordedLoopbackTriggers,
  clearRecordedLoopbackTriggers,
  type AnalysisWriteContext,
} from "../services/analysis-tools";
import type { LoopbackTriggerType } from "../services/analysis-tools";
import { analysisRuntimeConfig } from "../config/analysis-runtime";
import { resolveAnalysisRuntime } from "../config/analysis-runtime-resolver";
import * as runtimeStatus from "../services/runtime-status";
import {
  clearProviderSessionBinding,
  getWorkspaceDatabase,
} from "../services/workspace";
import { createRunLogger, timer } from "../utils/ai-logger";
import type { RunLogger } from "../utils/ai-logger";
import type { RuntimeAdapter } from "../services/ai/adapter-contract";
import { loadRuntimeAdapter } from "../services/ai/adapter-loader";
import {
  synthesizeReport,
  getSynthesisSystemPrompt,
} from "../services/synthesis-service";
import type { AnyDomainEventInput, DomainEventInputBare } from "../services/workspace/domain-event-types";
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

interface ActiveRun {
  runId: string;
  workspaceId: string;
  threadId: string;
  status: RunStatusValue;
  activePhase: MethodologyPhase | null;
  provider?: RuntimeProvider;
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
  /** Tool-based phase execution state */
  toolWriteContext: AnalysisWriteContext | null;
  toolMcpServer: unknown | null;
  resumedPhaseTurn:
    | {
        phaseTurnId: string;
        turnIndex: number;
        startedAt: number;
      }
    | null;
}

interface RunExecutionOptions {
  topic: string;
  combinedSignal: AbortSignal;
  runTimeoutSignal: AbortSignal;
  runTimeoutHandle: ReturnType<typeof setTimeout>;
  analysisTimer: ReturnType<typeof timer>;
  userSignal?: AbortSignal;
}

interface ResumeDurableRunInput {
  runId: string;
}

function clearAnalysisRunBinding(
  run: Pick<ActiveRun, "runId" | "threadId">,
): void {
  clearProviderSessionBinding(run.threadId, {
    runId: run.runId,
    purpose: "analysis",
    reason: "process_terminated",
  });
}

function resolveCompletedPhases(
  promptActivePhases: SupportedPhase[],
  phaseSummaries: PhaseTurnSummaryState[],
): MethodologyPhase[] {
  const completed = new Set<MethodologyPhase>();
  for (const summary of phaseSummaries) {
    if (summary.status === "completed") {
      completed.add(summary.phase);
    }
  }

  return promptActivePhases.filter((phase) => completed.has(phase));
}

function resolvePhaseTurnCounts(
  phaseSummaries: PhaseTurnSummaryState[],
): Partial<Record<MethodologyPhase, number>> {
  const counts: Partial<Record<MethodologyPhase, number>> = {};
  for (const summary of phaseSummaries) {
    counts[summary.phase] = Math.max(
      counts[summary.phase] ?? 0,
      summary.turnIndex,
    );
  }
  return counts;
}

function resolveResumePhaseIndex(run: ActiveRun): number {
  if (run.activePhase) {
    const activeIndex = run.activePhases.findIndex(
      (phase) => phase === run.activePhase,
    );
    if (activeIndex !== -1) {
      return activeIndex;
    }
  }

  return Math.min(run.phasesCompleted.length, run.activePhases.length);
}

// ── Constants ──

type SupportedPhase = SupportedAnalysisPhase;

const SUPPORTED_PHASES: SupportedPhase[] = SUPPORTED_ANALYSIS_PHASES;

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
const RUN_TIMEOUT_MS = analysisRuntimeConfig.orchestrator.runTimeoutMs;

// ── Synthesis adapter ──

async function loadSynthesisAdapter(
  provider?: string,
): Promise<RuntimeAdapter> {
  return loadRuntimeAdapter({
    provider,
    testStubLabel: "test-synthesis-adapter",
    supportsChatTurns: false,
  });
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

function appendRunLifecycleEvents(
  run: Pick<ActiveRun, "runId" | "workspaceId" | "threadId">,
  producer: string,
  events: DomainEventInputBare[],
): void {
  getWorkspaceDatabase().eventStore.appendEvents(
    events.map(
      (event) =>
        ({
          ...event,
          kind: "explicit" as const,
          workspaceId: run.workspaceId,
          threadId: run.threadId,
          runId: run.runId,
          producer,
        }) as AnyDomainEventInput,
    ),
  );
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
  const resumedPhaseTurn =
    run.resumedPhaseTurn && run.resumedPhaseTurn.phaseTurnId
      ? run.resumedPhaseTurn
      : null;
  run.resumedPhaseTurn = null;

  const phaseAbort = new AbortController();
  const onExternalAbort = () => phaseAbort.abort();
  externalSignal?.addEventListener("abort", onExternalAbort, { once: true });
  try {
    const result = await executePhaseTurn(
      phase,
      topic,
      run.toolMcpServer!,
      run.toolWriteContext!,
      {
        runId: run.runId,
        runKind: "analysis",
        workspaceId: run.workspaceId,
        threadId: run.threadId,
        activePhases: run.activePhases,
        completedPhases: run.phasesCompleted,
        progressCompletedBefore: run.phasesCompleted.length,
        progressTotal: run.activePhases.length,
        phaseTurnCounts: run.phaseTurnCounts,
        provider: run.provider,
        model: run.model,
        runtime: run.runtime,
        signal: phaseAbort.signal,
        logger: run.logger,
        producer: "analysis-agent",
        onProgress: emitProgress,
        ...(resumedPhaseTurn ? { resumePhaseTurn: resumedPhaseTurn } : {}),
      },
    );
    run.activePhaseTurnId = result.phaseTurnId;
    if (result.success) {
      run.logger.log("orchestrator", "tool-phase-complete", {
        phase,
        phaseTurnId: result.phaseTurnId,
        elapsedMs: Date.now() - phaseStart,
        entitiesCreated: result.summary?.entitiesCreated ?? 0,
        entitiesUpdated: result.summary?.entitiesUpdated ?? 0,
        relationshipsCreated: result.summary?.relationshipsCreated ?? 0,
      });
      runtimeStatus.completePhase(run.runId);
      drainEditQueue();
      return { success: true };
    } else {
      const errMsg = result.error ?? "Phase did not complete";
      run.logger.error("orchestrator", "tool-phase-failed", {
        phase,
        phaseTurnId: result.phaseTurnId,
        elapsedMs: Date.now() - phaseStart,
        error: errMsg,
      });
      return { success: false, error: errMsg };
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    run.logger.error("orchestrator", "tool-phase-error", {
      phase,
      phaseTurnId: run.activePhaseTurnId ?? undefined,
      elapsedMs: Date.now() - phaseStart,
      error: errMsg,
    });
    return { success: false, error: errMsg };
  } finally {
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

function startRunExecution(
  run: ActiveRun,
  options: RunExecutionOptions,
): Promise<void> {
  const executeAsync = async () => {
    try {
      const writeContext: AnalysisWriteContext = {
        workspaceId: run.workspaceId,
        threadId: run.threadId,
        runId: run.runId,
        phase: run.activePhases[resolveResumePhaseIndex(run)] ?? run.activePhases[0],
        allowedEntityTypes: [],
        onProgress: emitProgress,
      };
      run.toolWriteContext = writeContext;
      const { createToolBasedAnalysisMcpServer } =
        await import("../services/ai/claude-adapter");
      run.toolMcpServer = await createToolBasedAnalysisMcpServer(writeContext);
      run.logger.log("orchestrator", "tool-based-setup", {});

      let phaseIndex = resolveResumePhaseIndex(run);
      let passCount = 0;

      while (phaseIndex < run.activePhases.length) {
        if (run.status !== "running") break;

        const phase = run.activePhases[phaseIndex];
        const result = await executeSinglePhase(
          phase,
          options.topic,
          run,
          options.combinedSignal,
        );

        if (!result.success) {
          if (options.combinedSignal.aborted || result.error === "Aborted") {
            if (options.runTimeoutSignal.aborted && !options.userSignal?.aborted) {
              run.status = "failed";
              run.error = "Run-level timeout exceeded";
              const finishedAt = Date.now();
              const failure = runtimeStatus.inferRuntimeError(
                "Run-level timeout exceeded",
                run.provider,
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
                provider: run.provider,
              });
              run.logger.error("orchestrator", "run-timeout", {
                elapsedMs: options.analysisTimer.elapsed(),
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
              run.provider,
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
              provider: run.provider,
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
                run.provider,
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
                provider: run.provider,
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
          elapsedMs: options.analysisTimer.elapsed(),
        });

        const snapshot = entityGraphService.getAnalysis();
        if (resultSnapshots.size >= MAX_RESULT_SNAPSHOTS) {
          const oldestKey = resultSnapshots.keys().next().value;
          if (oldestKey !== undefined) resultSnapshots.delete(oldestKey);
        }
        resultSnapshots.set(run.runId, {
          entities: [...snapshot.entities],
          relationships: [...snapshot.relationships],
        });

        emitProgress({ type: "analysis_completed", runId: run.runId });
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
                  systemPrompt: getSynthesisSystemPrompt(),
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
        }

        runtimeStatus.releaseRun(run.runId, "completed");
      } else {
        run.logger.log("orchestrator", "analysis-finished", {
          status: run.status,
          phasesCompleted: run.phasesCompleted.length,
          error: run.error,
          elapsedMs: options.analysisTimer.elapsed(),
        });
      }
    } finally {
      clearTimeout(options.runTimeoutHandle);
      run.toolWriteContext = null;
      run.toolMcpServer = null;
      drainEditQueue();
      run.activePhase = null;
      if (run.status !== "running") {
        clearAnalysisRunBinding(run);
      }
      try {
        await run.logger.flush();
      } catch {
        // Logger flush must not prevent cleanup
      }
      runPromise = null;
      revalidationService.onRunComplete(
        run.provider,
        run.model,
        run.runtime,
        run.autoRevalidationEnabled,
      );
    }
  };

  return executeAsync();
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
  const canonicalProvider = normalizeRuntimeProvider(provider);
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
    provider: canonicalProvider,
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
    toolWriteContext: null,
    toolMcpServer: null,
    resumedPhaseTurn: null,
  };

  try {
    workspaceDatabase.eventStore.appendEvents([
      ...(resolvedThreadContext.createdThreadEvent
        ? [resolvedThreadContext.createdThreadEvent]
        : []),
      {
        kind: "explicit" as const,
        type: "run.created",
        workspaceId: resolvedThreadContext.workspaceId,
        threadId: resolvedThreadContext.threadId,
        runId,
        payload: {
          kind: "analysis",
          provider: canonicalProvider ?? null,
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
        kind: "explicit" as const,
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
      provider: canonicalProvider,
    });
    throw error;
  }

  // Reset the graph only after the run lock is held so losing concurrent
  // requests cannot wipe the canvas before acquireRun rejects them.
  entityGraphService.newAnalysis(topic, activeRun.workspaceId);

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

  const run = activeRun;
  runPromise = startRunExecution(run, {
    topic,
    combinedSignal,
    runTimeoutSignal,
    runTimeoutHandle,
    analysisTimer,
    userSignal: signal,
  });

  return {
    runId,
    workspaceId: resolvedThreadContext.workspaceId,
    threadId: resolvedThreadContext.threadId,
  };
}

export async function resumeDurableRun(
  input: ResumeDurableRunInput,
): Promise<{ runId: string; workspaceId: string; threadId: string }> {
  if (activeRun && activeRun.status === "running") {
    throw new Error("A run is already active");
  }
  if (runPromise !== null) {
    throw new Error("A run is already active");
  }

  const workspaceDatabase = getWorkspaceDatabase();
  const persistedRun = workspaceDatabase.runs.getRunState(input.runId);
  if (!persistedRun) {
    throw new Error(`Cannot resume missing run "${input.runId}"`);
  }
  if (persistedRun.status !== "running") {
    throw new Error(
      `Cannot resume run "${input.runId}" with status "${persistedRun.status}"`,
    );
  }

  const provider = normalizeRuntimeProvider(persistedRun.provider);
  const topic = entityGraphService.getAnalysis().topic.trim();
  if (topic.length === 0) {
    throw new Error(`Cannot resume run "${input.runId}" without analysis topic`);
  }

  const activePhases = normalizeRequestedActivePhases(
    persistedRun.promptProvenance?.activePhases,
  );
  const phaseSummaries =
    workspaceDatabase.phaseTurnSummaries.listPhaseTurnSummariesByRunId(
      persistedRun.id,
    );
  const completedPhases = resolveCompletedPhases(activePhases, phaseSummaries);
  while (
    completedPhases.length < persistedRun.progress.completed &&
    completedPhases.length < activePhases.length
  ) {
    const phase = activePhases[completedPhases.length];
    if (!completedPhases.includes(phase)) {
      completedPhases.push(phase);
    }
  }

  const resumedPhaseTurn =
    persistedRun.activePhase && persistedRun.latestPhaseTurnId
      ? phaseSummaries.find(
          (summary) =>
            summary.id === persistedRun.latestPhaseTurnId &&
            summary.phase === persistedRun.activePhase &&
            summary.status === "running",
        ) ?? null
      : null;

  if (persistedRun.activePhase && !resumedPhaseTurn) {
    throw new Error(
      `Cannot resume run "${input.runId}" without running phase turn "${persistedRun.latestPhaseTurnId ?? "unknown"}"`,
    );
  }

  const runtime = resolveAnalysisRuntime({
    effortLevel: persistedRun.effort as AnalysisRuntimeOverrides["effortLevel"],
  });
  const analysisTimer = timer();
  const abortController = new AbortController();
  const autoRevalidationEnabled =
    activePhases.length === SUPPORTED_PHASES.length;
  const logger = createRunLogger(persistedRun.id, {
    workspaceId: persistedRun.workspaceId,
    threadId: persistedRun.threadId,
  });

  if (
    !runtimeStatus.acquireRun("analysis", persistedRun.id, {
      totalPhases: activePhases.length,
    })
  ) {
    throw new Error("A run is already active");
  }
  runtimeStatus.setProgress(persistedRun.id, persistedRun.progress);
  runtimeStatus.setActivePhase(persistedRun.id, persistedRun.activePhase);

  const remainingTimeoutMs = Math.max(
    0,
    RUN_TIMEOUT_MS - (Date.now() - persistedRun.startedAt),
  );
  const runTimeoutController = new AbortController();
  const runTimeoutHandle = setTimeout(
    () => runTimeoutController.abort(),
    remainingTimeoutMs,
  );
  const runTimeoutSignal = runTimeoutController.signal;
  const combinedSignal = AbortSignal.any([
    abortController.signal,
    runTimeoutSignal,
  ]);
  combinedSignal.addEventListener(
    "abort",
    () => {
      if (!abortController.signal.aborted) abortController.abort();
    },
    { once: true },
  );

  activeRun = {
    runId: persistedRun.id,
    workspaceId: persistedRun.workspaceId,
    threadId: persistedRun.threadId,
    status: "running",
    activePhase: persistedRun.activePhase,
    provider,
    model: persistedRun.model ?? undefined,
    runtime,
    activePhases,
    autoRevalidationEnabled,
    editQueue: [],
    startTime: persistedRun.startedAt,
    phasesCompleted: completedPhases,
    phaseTurnCounts: resolvePhaseTurnCounts(phaseSummaries),
    activePhaseTurnId: persistedRun.latestPhaseTurnId ?? null,
    abortController,
    logger,
    promptProvenance:
      persistedRun.promptProvenance ?? createRunPromptProvenance(activePhases),
    toolWriteContext: null,
    toolMcpServer: null,
    resumedPhaseTurn: resumedPhaseTurn
      ? {
          phaseTurnId: resumedPhaseTurn.id,
          turnIndex: resumedPhaseTurn.turnIndex,
          startedAt: resumedPhaseTurn.startedAt,
        }
      : null,
  };

  logger.log("orchestrator", "analysis-resume-start", {
    topic,
    provider,
    model: persistedRun.model,
    activePhase: persistedRun.activePhase,
    progress: persistedRun.progress,
    resumedPhaseTurnId: resumedPhaseTurn?.id,
  });

  runPromise = startRunExecution(activeRun, {
    topic,
    combinedSignal,
    runTimeoutSignal,
    runTimeoutHandle,
    analysisTimer,
  });

  return {
    runId: persistedRun.id,
    workspaceId: persistedRun.workspaceId,
    threadId: persistedRun.threadId,
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
      provider: activeRun.provider,
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
