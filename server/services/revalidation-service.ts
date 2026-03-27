// revalidation-service.ts — cascade invalidation with debounced auto-trigger.
// Listens for stale_marked events from entity-graph-service,
// debounces for 2s, then re-runs phases from the earliest stale one.
// Suppressed during active analysis runs; deferred staleIds await explicit revalidation.

import type { MethodologyPhase } from "../../shared/types/methodology";
import type { AnalysisProgressEvent } from "../../shared/types/events";
import type {
  ResolvedAnalysisRuntime,
  RuntimeProvider,
} from "../../shared/types/analysis-runtime";
import { normalizeRuntimeProvider } from "../../shared/types/analysis-runtime";
import { V2_PHASES, PHASE_NUMBERS } from "../../src/types/methodology";
import { analysisRuntimeConfig } from "../config/analysis-runtime";
import * as entityGraphService from "./entity-graph-service";
import * as orchestrator from "../agents/analysis-agent";
import * as runtimeStatus from "./runtime-status";
import {
  getProviderSessionBinding,
  getWorkspaceDatabase,
  upsertProviderSessionBinding,
} from "./workspace";
import { runPhase } from "./analysis-service";
import {
  buildPhasePromptBundle,
  createRunPromptProvenance,
} from "./analysis-prompt-provenance";
import { buildPhaseBrief } from "./analysis-phase-brief";
import { commitPhaseSnapshot } from "./revision-diff";
import { createRunLogger, serverWarn, timer } from "../utils/ai-logger";
import type {
  AnyDomainEventInput,
  DomainEventInputBare,
} from "./workspace/domain-event-types";
import { nanoid } from "nanoid";
import type { RunSummaryState } from "../../shared/types/workspace-state";

// ── Constants ──

const DEBOUNCE_MS = analysisRuntimeConfig.revalidation.debounceMs;

// ── Revalidation run status tracking ──

export type RevalRunStatusValue =
  | "running"
  | "completed"
  | "failed"
  | "deferred";

export interface RevalRunStatus {
  runId: string;
  status: RevalRunStatusValue;
  phasesCompleted: number;
  error?: string;
}

// ── Module-level state ──

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingStaleIds = new Set<string>();
const progressListeners = new Set<(event: AnalysisProgressEvent) => void>();
let unsubscribeMutation: (() => void) | null = null;
const revalRunStatuses = new Map<string, RevalRunStatus>();

/** Provider/model from the most recent analysis run, used for revalidation continuity. */
let lastRunProvider: RuntimeProvider | undefined;
let lastRunModel: string | undefined;
let lastRunRuntime: ResolvedAnalysisRuntime | undefined;

function queuePendingRevalidation(staleIds: string[]): void {
  if (staleIds.length === 0) return;

  for (const id of staleIds) {
    pendingStaleIds.add(id);
  }

  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const ids = Array.from(pendingStaleIds);
    pendingStaleIds.clear();
    if (ids.length > 0) {
      revalidate(ids);
    }
  }, DEBOUNCE_MS);
}

// ── Progress event helpers ──

function emitProgress(event: AnalysisProgressEvent): void {
  for (const cb of progressListeners) {
    try {
      cb(event);
    } catch {
      // Listener errors must not break revalidation flow
    }
  }
}

function appendRevalidationEvents(
  runId: string,
  events: DomainEventInputBare[],
): void {
  getWorkspaceDatabase().eventStore.appendEvents(
    events.map(
      (event) =>
        ({
          ...event,
          kind: "run" as const,
          runId,
          producer: "revalidation-service",
        }) as AnyDomainEventInput,
    ),
  );
}

function buildRevalidationSummary(
  completedPhases: number,
  statusMessage: string,
  failedPhase?: MethodologyPhase,
): RunSummaryState {
  return {
    statusMessage,
    failedPhase,
    completedPhases,
  };
}

// ── Phase resolution ──

/**
 * Determine the earliest phase that needs re-running based on stale entity provenance.
 * Returns the first V1 phase (by order) that contains at least one stale entity.
 */
function findEarliestStalePhase(staleIds: string[]): MethodologyPhase | null {
  if (staleIds.length === 0) return null;

  const analysis = entityGraphService.getAnalysis();
  const staleSet = new Set(staleIds);
  const staleEntities = analysis.entities.filter((e) => staleSet.has(e.id));

  if (staleEntities.length === 0) return null;

  // Find the earliest phase among stale entities
  let earliest: MethodologyPhase | null = null;
  let earliestNumber = Infinity;

  for (const entity of staleEntities) {
    const phaseNum = PHASE_NUMBERS[entity.phase];
    if (phaseNum < earliestNumber) {
      earliestNumber = phaseNum;
      earliest = entity.phase;
    }
  }

  return earliest;
}

/**
 * Get the ordered list of V1 phases starting from a given phase through the end.
 */
function phasesFrom(startPhase: MethodologyPhase): MethodologyPhase[] {
  const startIdx = V2_PHASES.indexOf(startPhase);
  if (startIdx === -1) return [];
  return V2_PHASES.slice(startIdx);
}

// ── Core API ──

/**
 * Schedule a debounced revalidation. If called again within 2s, resets the timer
 * and merges the new staleIds. If an analysis run is active, stores ids for
 * deferred revalidation that the user can explicitly approve later.
 */
export function scheduleRevalidation(staleIds: string[]): void {
  const scheduleLogger = createRunLogger(`reval-sched-${Date.now()}`);
  scheduleLogger.log("revalidation", "scheduled", {
    staleIds,
  });

  // If an analysis run is active, defer — don't start the timer
  if (orchestrator.isRunning()) {
    runtimeStatus.deferRevalidation(staleIds, {
      reason: "analysis-active",
    });
    scheduleLogger.log("revalidation", "suppressed", {
      deferredCount: runtimeStatus.getDeferredRevalidationIds().length,
    });
    return;
  }

  if (debounceTimer !== null) {
    scheduleLogger.log("revalidation", "debounce-reset", {
      pendingCount: pendingStaleIds.size + staleIds.length,
    });
  }

  queuePendingRevalidation(staleIds);
}

/**
 * Run revalidation asynchronously. Returns immediately with { runId }.
 * The actual phase re-runs execute via a microtask so the caller can
 * poll status via getRevalStatus(runId).
 */
export function revalidate(
  staleEntityIds?: string[],
  phase?: string,
): { runId: string } {
  const runId = `reval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const occurredAt = Date.now();

  // Concurrency guard: if an analysis run is active, defer for later
  if (orchestrator.isRunning()) {
    const ids = staleEntityIds ?? [];
    runtimeStatus.deferRevalidation(ids, {
      reason: "analysis-active",
    });
    revalRunStatuses.set(runId, {
      runId,
      status: "deferred",
      phasesCompleted: 0,
    });
    return { runId };
  }

  // Determine starting phase synchronously so we can return early if nothing to do
  let startPhase: MethodologyPhase | null = null;

  if (phase) {
    startPhase = phase as MethodologyPhase;
  } else if (staleEntityIds && staleEntityIds.length > 0) {
    startPhase = findEarliestStalePhase(staleEntityIds);
  } else {
    // Fall back to any currently stale entities
    const currentStale = entityGraphService.getStaleEntityIds();
    startPhase = findEarliestStalePhase(currentStale);
  }

  if (!startPhase) {
    runtimeStatus.consumeDeferredRevalidationIds();
    revalRunStatuses.set(runId, {
      runId,
      status: "completed",
      phasesCompleted: 0,
    });
    return { runId };
  }

  const phases = phasesFrom(startPhase);

  if (
    !runtimeStatus.acquireRun("revalidation", runId, {
      totalPhases: phases.length,
    })
  ) {
    queuePendingRevalidation(staleEntityIds ?? []);
    revalRunStatuses.set(runId, {
      runId,
      status: "deferred",
      phasesCompleted: 0,
      error: "Revalidation already active; stale ids re-queued",
    });
    serverWarn(runId, "revalidation", "run-skipped", {
      reason: "runtime-status-busy",
      staleEntityIds,
      activeStatus: runtimeStatus.getSnapshot(),
    });
    return { runId };
  }

  runtimeStatus.consumeDeferredRevalidationIds();

  // Register as running before async work begins
  revalRunStatuses.set(runId, { runId, status: "running", phasesCompleted: 0 });
  const workspaceDatabase = getWorkspaceDatabase();
  const threadContext = workspaceDatabase.eventStore.resolveThreadContext({
    producer: "revalidation-service",
    occurredAt,
  });
  const promptProvenance = createRunPromptProvenance(phases);
  workspaceDatabase.eventStore.appendEvents([
    ...(threadContext.createdThreadEvent
      ? [threadContext.createdThreadEvent]
      : []),
    {
      kind: "explicit" as const,
      type: "run.created",
      workspaceId: threadContext.workspaceId,
      threadId: threadContext.threadId,
      runId,
      payload: {
        kind: "revalidation",
        provider: lastRunProvider ?? null,
        model: lastRunModel ?? null,
        effort: lastRunRuntime?.effortLevel ?? null,
        status: "running",
        startedAt: occurredAt,
        totalPhases: phases.length,
        promptProvenance,
        logCorrelation: {
          logFileName: `${runId}.jsonl`,
        },
      },
      occurredAt,
      producer: "revalidation-service",
    },
    {
      kind: "explicit" as const,
      type: "run.status.changed",
      workspaceId: threadContext.workspaceId,
      threadId: threadContext.threadId,
      runId,
      payload: {
        status: "running",
        activePhase: null,
        progress: {
          completed: 0,
          total: phases.length,
        },
        summary: buildRevalidationSummary(0, "Run started"),
      },
      occurredAt,
      producer: "revalidation-service",
    },
  ]);

  // Execute phase re-runs asynchronously
  const capturedStartPhase = startPhase;
  Promise.resolve().then(() => executeRevalidation(runId, capturedStartPhase));

  return { runId };
}

/**
 * Internal: execute the revalidation phases. Called asynchronously from revalidate().
 */
async function executeRevalidation(
  runId: string,
  startPhase: MethodologyPhase,
): Promise<void> {
  const logger = createRunLogger(runId);
  const revalTimer = timer();
  const runState = getWorkspaceDatabase().runs.getRunState(runId);
  if (!runState) {
    throw new Error(`Missing durable revalidation run state for "${runId}".`);
  }

  // Get the analysis topic for phase re-execution
  const topic = entityGraphService.getAnalysis().topic;

  // Re-run from the earliest stale phase through the end
  const phases = phasesFrom(startPhase);
  let phasesCompleted = 0;
  const phaseTurnCounts: Partial<Record<MethodologyPhase, number>> = {};
  let latestPhaseTurnId: string | undefined;

  const staleCount = entityGraphService.getStaleEntityIds().length;
  logger.log("revalidation", "start", {
    runId,
    phases: phases.length,
    staleCount,
  });

  for (const p of phases) {
    const turnIndex = (phaseTurnCounts[p] ?? 0) + 1;
    phaseTurnCounts[p] = turnIndex;
    const phaseTurnId = `phase-turn-${nanoid()}`;
    latestPhaseTurnId = phaseTurnId;
    const existingBinding = getProviderSessionBinding(
      runState.threadId,
      "analysis",
    );
    if (existingBinding) {
      upsertProviderSessionBinding({
        ...existingBinding,
        runId,
        phaseTurnId,
        updatedAt: Date.now(),
      });
    }
    runtimeStatus.setActivePhase(runId, p);
    const completedPhases = V2_PHASES.slice(0, V2_PHASES.indexOf(p));
    const phaseBrief = buildPhaseBrief({
      phase: p,
      topic,
      completedPhases,
      activePhases: phases,
    });
    const phasePromptBundle = buildPhasePromptBundle({
      phase: p,
      topic,
      phaseBrief: phaseBrief.phaseBrief,
      effortLevel: lastRunRuntime?.effortLevel ?? "medium",
    });
    appendRevalidationEvents(runId, [
      {
        type: "phase.started",
        payload: {
          phase: p,
          phaseTurnId,
          turnIndex,
          promptProvenance: phasePromptBundle.promptProvenance,
        },
        occurredAt: Date.now(),
      },
      {
        type: "run.status.changed",
        payload: {
          status: "running",
          activePhase: p,
          progress: {
            completed: phasesCompleted,
            total: phases.length,
          },
          summary: buildRevalidationSummary(phasesCompleted, `Running ${p}`),
          latestPhaseTurnId: phaseTurnId,
        },
        occurredAt: Date.now(),
      },
    ]);
    emitProgress({ type: "phase_started", phase: p, runId });
    logger.log("revalidation", "phase-rerun", { phase: p, runId });
    const phaseStart = Date.now();
    let result = await runPhase(p, topic, {
      workspaceId: runState.workspaceId,
      threadId: runState.threadId,
      promptBundle: {
        system: phasePromptBundle.system,
        user: phasePromptBundle.user,
        toolPolicy: phasePromptBundle.toolPolicy,
      },
      provider: lastRunProvider,
      model: lastRunModel,
      runtime: lastRunRuntime,
      phaseBrief: phaseBrief.phaseBrief,
      logger,
      runId,
      phaseTurnId,
      onActivity: (activity) => {
        appendRevalidationEvents(runId, [
          {
            type: "phase.activity.recorded",
            payload: {
              phase: p,
              phaseTurnId,
              kind: activity.kind,
              message: activity.message,
              ...(activity.toolName ? { toolName: activity.toolName } : {}),
              ...(activity.query ? { query: activity.query } : {}),
            },
            occurredAt: Date.now(),
          },
        ]);
      },
    });

    if (result.success) {
      try {
        let commitResult = commitPhaseSnapshot({
          phase: p,
          runId,
          entities: result.entities,
          relationships: result.relationships,
        });

        if (commitResult.status === "retry_required") {
          logger.warn("revalidation", "truncation-retry", {
            phase: p,
            originalAiEntityCount: commitResult.originalAiEntityCount,
            returnedAiEntityCount: commitResult.returnedAiEntityCount,
          });

          const retryPromptBundle = buildPhasePromptBundle({
            phase: p,
            topic,
            phaseBrief: phaseBrief.phaseBrief,
            revisionRetryInstruction: commitResult.retryMessage,
            effortLevel: lastRunRuntime?.effortLevel ?? "medium",
          });
          appendRevalidationEvents(runId, [
            {
              type: "phase.started",
              payload: {
                phase: p,
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
                activePhase: p,
                progress: {
                  completed: phasesCompleted,
                  total: phases.length,
                },
                summary: buildRevalidationSummary(
                  phasesCompleted,
                  `Retrying ${p}`,
                ),
                latestPhaseTurnId: phaseTurnId,
              },
              occurredAt: Date.now(),
            },
          ]);

          result = await runPhase(p, topic, {
            workspaceId: runState.workspaceId,
            threadId: runState.threadId,
            promptBundle: {
              system: retryPromptBundle.system,
              user: retryPromptBundle.user,
              toolPolicy: retryPromptBundle.toolPolicy,
            },
            provider: lastRunProvider,
            model: lastRunModel,
            runtime: lastRunRuntime,
            phaseBrief: phaseBrief.phaseBrief,
            revisionRetryInstruction: commitResult.retryMessage,
            logger,
            runId,
            phaseTurnId,
            onActivity: (activity) => {
              appendRevalidationEvents(runId, [
                {
                  type: "phase.activity.recorded",
                  payload: {
                    phase: p,
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
            },
          });

          if (!result.success) {
            const error = result.error ?? "Revalidation phase failed";
            const failure = runtimeStatus.inferRuntimeError(
              error,
              lastRunProvider,
            );
            appendRevalidationEvents(runId, [
              {
                type: "run.failed",
                payload: {
                  activePhase: p,
                  latestPhaseTurnId: phaseTurnId,
                  failedPhase: p,
                  error: failure,
                  finishedAt: Date.now(),
                  summary: buildRevalidationSummary(phasesCompleted, error, p),
                },
                occurredAt: Date.now(),
              },
              {
                type: "run.status.changed",
                payload: {
                  status: "failed",
                  activePhase: p,
                  progress: {
                    completed: phasesCompleted,
                    total: phases.length,
                  },
                  failedPhase: p,
                  failure,
                  finishedAt: Date.now(),
                  summary: buildRevalidationSummary(phasesCompleted, error, p),
                  latestPhaseTurnId: phaseTurnId,
                },
                occurredAt: Date.now(),
              },
            ]);
            revalRunStatuses.set(runId, {
              runId,
              status: "failed",
              phasesCompleted,
              error,
            });
            runtimeStatus.releaseRun(runId, "failed", {
              failedPhase: p,
              failureMessage: error,
              provider: lastRunProvider,
            });
            emitProgress({
              type: "analysis_failed",
              runId,
              error: failure,
            });
            return;
          }

          commitResult = commitPhaseSnapshot({
            phase: p,
            runId,
            entities: result.entities,
            relationships: result.relationships,
            allowLargeReductionCommit: true,
          });
        }

        if (commitResult.status !== "applied") {
          throw new Error("Revision diff did not produce an applied result");
        }

        if (commitResult.summary.currentPhaseEntityIds.length > 0) {
          entityGraphService.clearStale(
            commitResult.summary.currentPhaseEntityIds,
          );
        }

        phasesCompleted++;
        revalRunStatuses.set(runId, {
          runId,
          status: "running",
          phasesCompleted,
        });
        runtimeStatus.completePhase(runId);
        const phaseSummary = {
          entitiesCreated: commitResult.summary.entitiesCreated,
          relationshipsCreated: commitResult.summary.relationshipsCreated,
          entitiesUpdated: commitResult.summary.entitiesUpdated,
          durationMs: Date.now() - phaseStart,
        };
        appendRevalidationEvents(runId, [
          {
            type: "phase.completed",
            payload: {
              phase: p,
              phaseTurnId,
              summary: phaseSummary,
            },
            occurredAt: Date.now(),
          },
          {
            type: "run.status.changed",
            payload: {
              status: "running",
              activePhase: null,
              progress: {
                completed: phasesCompleted,
                total: phases.length,
              },
              summary: buildRevalidationSummary(
                phasesCompleted,
                `Completed ${p}`,
              ),
              latestPhaseTurnId: phaseTurnId,
            },
            occurredAt: Date.now(),
          },
        ]);

        emitProgress({
          type: "phase_completed",
          phase: p,
          runId,
          summary: phaseSummary,
        });
      } catch (err) {
        const error =
          err instanceof Error
            ? `Revision diff validation error: ${err.message}`
            : `Revision diff validation error: ${String(err)}`;
        const failure = runtimeStatus.inferRuntimeError(
          error,
          lastRunProvider,
        );
        appendRevalidationEvents(runId, [
          {
            type: "run.failed",
            payload: {
              activePhase: p,
              latestPhaseTurnId: phaseTurnId,
              failedPhase: p,
              error: failure,
              finishedAt: Date.now(),
              summary: buildRevalidationSummary(phasesCompleted, error, p),
            },
            occurredAt: Date.now(),
          },
          {
            type: "run.status.changed",
            payload: {
              status: "failed",
              activePhase: p,
              progress: {
                completed: phasesCompleted,
                total: phases.length,
              },
              failedPhase: p,
              failure,
              finishedAt: Date.now(),
              summary: buildRevalidationSummary(phasesCompleted, error, p),
              latestPhaseTurnId: phaseTurnId,
            },
            occurredAt: Date.now(),
          },
        ]);
        revalRunStatuses.set(runId, {
          runId,
          status: "failed",
          phasesCompleted,
          error,
        });
        runtimeStatus.releaseRun(runId, "failed", {
          failedPhase: p,
          failureMessage: error,
          provider: lastRunProvider,
        });
        emitProgress({
          type: "analysis_failed",
          runId,
          error: failure,
        });
        return;
      }
    } else {
      const error = result.error ?? "Revalidation phase failed";
      const failure = runtimeStatus.inferRuntimeError(
        error,
        lastRunProvider,
      );
      appendRevalidationEvents(runId, [
        {
          type: "run.failed",
          payload: {
            activePhase: p,
            latestPhaseTurnId: phaseTurnId,
            failedPhase: p,
            error: failure,
            finishedAt: Date.now(),
            summary: buildRevalidationSummary(phasesCompleted, error, p),
          },
          occurredAt: Date.now(),
        },
        {
          type: "run.status.changed",
          payload: {
            status: "failed",
            activePhase: p,
            progress: {
              completed: phasesCompleted,
              total: phases.length,
            },
            failedPhase: p,
            failure,
            finishedAt: Date.now(),
            summary: buildRevalidationSummary(phasesCompleted, error, p),
            latestPhaseTurnId: phaseTurnId,
          },
          occurredAt: Date.now(),
        },
      ]);
      revalRunStatuses.set(runId, {
        runId,
        status: "failed",
        phasesCompleted,
        error,
      });
      runtimeStatus.releaseRun(runId, "failed", {
        failedPhase: p,
        failureMessage: error,
        provider: lastRunProvider,
      });
      emitProgress({
        type: "analysis_failed",
        runId,
        error: failure,
      });
      return;
    }
  }

  revalRunStatuses.set(runId, { runId, status: "completed", phasesCompleted });
  appendRevalidationEvents(runId, [
    {
      type: "run.completed",
      payload: {
        finishedAt: Date.now(),
        summary: buildRevalidationSummary(phasesCompleted, "Run completed"),
        latestPhaseTurnId,
      },
      occurredAt: Date.now(),
    },
    {
      type: "run.status.changed",
      payload: {
        status: "completed",
        activePhase: null,
        progress: {
          completed: phasesCompleted,
          total: phases.length,
        },
        finishedAt: Date.now(),
        summary: buildRevalidationSummary(phasesCompleted, "Run completed"),
        latestPhaseTurnId,
      },
      occurredAt: Date.now(),
    },
  ]);
  runtimeStatus.releaseRun(runId, "completed");

  const totalEntities = entityGraphService.getAnalysis().entities.length;
  logger.log("revalidation", "complete", {
    runId,
    phasesRerun: phasesCompleted,
    entitiesCreated: totalEntities,
    elapsedMs: revalTimer.elapsed(),
  });
  await logger.flush();
}

/**
 * Get the status of a revalidation run by its runId.
 * Returns null if the runId is not found.
 */
export function getRevalStatus(runId: string): RevalRunStatus | null {
  return revalRunStatuses.get(runId) ?? null;
}

export function getActiveRevalStatus(): RevalRunStatus | null {
  const statuses = Array.from(revalRunStatuses.values());
  for (let index = statuses.length - 1; index >= 0; index -= 1) {
    const status = statuses[index];
    if (status.status === "running" || status.status === "deferred") {
      return status;
    }
  }

  return null;
}

/**
 * Called by the orchestrator when a run finishes. Captures provider/model
 * for revalidation continuity. Deferred staleIds remain queued until the user
 * explicitly requests revalidation.
 */
export function onRunComplete(
  provider?: string,
  model?: string,
  runtime?: ResolvedAnalysisRuntime,
  autoRevalidationEnabled = true,
): void {
  if (provider !== undefined) {
    lastRunProvider = normalizeRuntimeProvider(provider);
  }
  if (model !== undefined) lastRunModel = model;
  if (runtime !== undefined) lastRunRuntime = runtime;

  if (!autoRevalidationEnabled) {
    serverWarn(undefined, "revalidation", "auto-revalidation-disabled", {
      pendingStaleCount: pendingStaleIds.size,
      deferredStaleCount: runtimeStatus.getDeferredRevalidationIds().length,
      reason: "subset-run",
    });
  }
}

// ── Event subscription ──

export function onProgress(
  callback: (event: AnalysisProgressEvent) => void,
): () => void {
  progressListeners.add(callback);
  return () => {
    progressListeners.delete(callback);
  };
}

/**
 * Subscribe to entity-graph-service mutation events.
 * Called once at module init or explicitly for wiring.
 */
export function wire(): void {
  if (unsubscribeMutation) return; // Already wired
  unsubscribeMutation = entityGraphService.onMutation((event) => {
    if (event.type === "stale_marked") {
      scheduleRevalidation(event.entityIds);
    }
  });

  const existingStaleIds = entityGraphService.getStaleEntityIds();
  if (existingStaleIds.length > 0) {
    runtimeStatus.deferRevalidation(existingStaleIds, {
      revealWhenIdle: true,
      reason: "startup-stale-scan",
    });
  }
}

export function unwire(): void {
  if (unsubscribeMutation) {
    unsubscribeMutation();
    unsubscribeMutation = null;
  }
}

// ── Auto-wire on import ──

wire();

// ── Testing ──

/** Reset all module state. Only for use in tests. */
export function _resetForTest(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingStaleIds.clear();
  progressListeners.clear();
  revalRunStatuses.clear();
  lastRunProvider = undefined;
  lastRunModel = undefined;
  lastRunRuntime = undefined;
  runtimeStatus._resetForTest();
  unwire();
}

/** Expose pending stale IDs for test assertions. */
export function _getPendingStaleIds(): Set<string> {
  return pendingStaleIds;
}

/** Expose deferred stale IDs for test assertions. */
export function _getDeferredStaleIds(): Set<string> {
  return new Set(runtimeStatus.getDeferredRevalidationIds());
}
