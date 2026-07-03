// revalidation-service.ts — cascade invalidation with debounced auto-trigger.
// Listens for stale_marked events from entity-graph-service,
// debounces for 2s, then re-runs phases from the earliest stale one.
// Suppressed during active analysis runs; deferred staleIds await explicit revalidation.

import type { MethodologyPhase } from "../../shared/types/methodology";
import type { AnalysisProgressEvent } from "../../shared/types/events";
import type { ResolvedAnalysisRuntime } from "../../shared/types/analysis-runtime";
import { RUNNABLE_PHASES, PHASE_NUMBERS } from "../../src/types/methodology";
import { analysisRuntimeConfig } from "../config/analysis-runtime";
import * as entityGraphService from "./entity-graph-service";
import * as orchestrator from "../agents/analysis-agent";
import * as runtimeStatus from "./runtime-status";
import { runPhase } from "./analysis-service";
import { commitPhaseSnapshot } from "./revision-diff";
import {
  createRunLogger,
  serverWarn,
  timer,
  type RunLogger,
} from "../utils/ai-logger";

// ── Constants ──

const DEBOUNCE_MS = analysisRuntimeConfig.revalidation.debounceMs;
export const MAX_REVAL_RUN_STATUSES = 50;

// ── Revalidation run status tracking ──

export type RevalRunStatusValue =
  | "running"
  | "completed"
  | "failed"
  | "deferred"
  | "aborted";

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
let lastRunProvider: string | undefined;
let lastRunModel: string | undefined;
let lastRunRuntime: ResolvedAnalysisRuntime | undefined;

function setRevalRunStatus(runId: string, status: RevalRunStatus): void {
  if (revalRunStatuses.has(runId)) {
    revalRunStatuses.delete(runId);
  }
  revalRunStatuses.set(runId, status);
  evictOldRevalRunStatuses();
}

function evictOldRevalRunStatuses(): void {
  while (revalRunStatuses.size > MAX_REVAL_RUN_STATUSES) {
    const oldestEvictable = Array.from(revalRunStatuses.entries()).find(
      ([, status]) => status.status !== "running",
    );
    if (!oldestEvictable) return;
    revalRunStatuses.delete(oldestEvictable[0]);
  }
}

function getRunningRevalStatus(): RevalRunStatus | null {
  const statuses = Array.from(revalRunStatuses.values());
  for (let index = statuses.length - 1; index >= 0; index -= 1) {
    const status = statuses[index];
    if (status.status === "running" && runtimeStatus.isActiveRun(status.runId)) {
      return status;
    }
  }
  return null;
}

async function dropStaleCommitIfNeeded(
  runId: string,
  phase: MethodologyPhase,
  capturedEpoch: number,
  logger: RunLogger,
): Promise<boolean> {
  const currentEpoch = entityGraphService.getAnalysisEpoch();
  const active = runtimeStatus.isActiveRun(runId);
  if (currentEpoch === capturedEpoch && active) {
    return false;
  }

  const detail = {
    phase,
    capturedEpoch,
    currentEpoch,
    active,
  };
  logger.warn("revalidation", "stale-commit-dropped", detail);
  serverWarn(runId, "revalidation", "stale-commit-dropped", detail);

  const existing = revalRunStatuses.get(runId);
  if (existing?.status === "running") {
    setRevalRunStatus(runId, {
      runId,
      status: "aborted",
      phasesCompleted: existing.phasesCompleted,
      error: "Revalidation became stale before commit",
    });
  }
  if (active) {
    runtimeStatus.releaseRun(runId, "cancelled");
  }
  await logger.flush();
  return true;
}

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

// ── Phase resolution ──

/**
 * Determine the earliest phase that needs re-running based on stale entity provenance.
 * Returns the first runnable phase (by order) that contains at least one stale entity.
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
 * Get the ordered list of runnable phases starting from a given phase through the end.
 */
function phasesFrom(startPhase: MethodologyPhase): MethodologyPhase[] {
  const startIdx = RUNNABLE_PHASES.indexOf(startPhase);
  if (startIdx === -1) return [];
  return RUNNABLE_PHASES.slice(startIdx);
}

// ── Challenge handling (9A / 2.2A) ──

function entityDisplayName(entity: {
  id: string;
  data: Record<string, unknown>;
}): string {
  if (typeof entity.data.name === "string") return entity.data.name;
  if (typeof entity.data.content === "string") {
    return entity.data.content.slice(0, 80);
  }
  return entity.id;
}

/**
 * Pending challenges whose entity currently belongs to the given phase.
 * Challenges against already-deleted entities have no phase to run in; they
 * resolve as REMOVED when any phase commit runs (handled in resolution).
 */
function pendingChallengesForPhase(
  phase: MethodologyPhase,
): ReturnType<typeof entityGraphService.getPendingChallenges> {
  return entityGraphService.getPendingChallenges().filter((challenge) => {
    const entity = entityGraphService.getEntityById(challenge.entityId);
    return entity?.phase === phase;
  });
}

/**
 * Build the objection block injected into the phase prompt (9A). The model is
 * explicitly instructed to address each objection in the challenged entity's
 * rationale — whether it revises, keeps, or removes the entity.
 */
function buildChallengeContext(
  challenges: ReturnType<typeof entityGraphService.getPendingChallenges>,
): string | undefined {
  if (challenges.length === 0) return undefined;

  const lines = challenges.map((challenge, index) => {
    const entity = entityGraphService.getEntityById(challenge.entityId);
    const name = entity
      ? entityDisplayName(
          entity as { id: string; data: Record<string, unknown> },
        )
      : challenge.entityId;
    return `${index + 1}. Entity ${challenge.entityId} ("${name}"): ${challenge.objection}`;
  });

  return [
    "HUMAN CHALLENGES — a human analyst has objected to specific entities from this phase.",
    "For EACH challenged entity below, you MUST:",
    "- Re-examine it against the objection using available evidence.",
    "- If the objection is valid, revise the entity (or omit it if it cannot stand).",
    "- Whether you revise it or keep it unchanged, the entity's `rationale` field MUST directly address the objection and explain your verdict.",
    "",
    ...lines,
  ].join("\n");
}

/**
 * Resolve challenges after the phase they target has been re-run (2.2A).
 * Outcomes: REMOVED (entity deleted by re-run), REVISED (content changed in
 * this run — response diff lives at {entityId, responseLogNo}), CONFIRMED
 * (model kept it; rationale carries the answer to the objection).
 */
function resolveChallengesAfterRerun(
  challenges: ReturnType<typeof entityGraphService.getPendingChallenges>,
  runId: string,
): void {
  for (const challenge of challenges) {
    const entity = entityGraphService.getEntityById(challenge.entityId);
    if (!entity) {
      entityGraphService.resolveChallenge(challenge.id, {
        outcome: "REMOVED",
        runId,
      });
      continue;
    }

    const responseEntry = [...(entity.revisionLog ?? [])]
      .reverse()
      .find((entry) => entry.runId === runId && entry.fieldDiffs.length > 0);

    if (responseEntry) {
      entityGraphService.resolveChallenge(challenge.id, {
        outcome: "REVISED",
        runId,
        responseLogNo: responseEntry.logNo,
        responseRationale: entity.rationale,
      });
    } else {
      // No-diff CONFIRMED is intentionally not treated as verified evidence:
      // the graph did not change, so the UI asks the analyst to review it.
      entityGraphService.resolveChallenge(challenge.id, {
        outcome: "CONFIRMED",
        runId,
        responseRationale: entity.rationale,
        unverified: true,
      });
    }
  }
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

  // Concurrency guard: if an analysis run is active, defer for later
  if (orchestrator.isRunning()) {
    const ids = staleEntityIds ?? [];
    runtimeStatus.deferRevalidation(ids, {
      reason: "analysis-active",
    });
    setRevalRunStatus(runId, {
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
    setRevalRunStatus(runId, {
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
    setRevalRunStatus(runId, {
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
  setRevalRunStatus(runId, {
    runId,
    status: "running",
    phasesCompleted: 0,
  });

  // Execute phase re-runs asynchronously
  const capturedStartPhase = startPhase;
  const capturedEpoch = entityGraphService.getAnalysisEpoch();
  Promise.resolve().then(() =>
    executeRevalidation(runId, capturedStartPhase, capturedEpoch),
  );

  return { runId };
}

/**
 * Internal: execute the revalidation phases. Called asynchronously from revalidate().
 */
async function executeRevalidation(
  runId: string,
  startPhase: MethodologyPhase,
  capturedEpoch: number,
): Promise<void> {
  const logger = createRunLogger(runId);
  const revalTimer = timer();

  // Get the analysis topic for phase re-execution
  const topic = entityGraphService.getAnalysis().topic;

  // Re-run from the earliest stale phase through the end
  const phases = phasesFrom(startPhase);
  let phasesCompleted = 0;

  const staleCount = entityGraphService.getStaleEntityIds().length;
  logger.log("revalidation", "start", {
    runId,
    phases: phases.length,
    staleCount,
  });

  for (const p of phases) {
    runtimeStatus.setActivePhase(runId, p);
    emitProgress({ type: "phase_started", phase: p, runId });
    logger.log("revalidation", "phase-rerun", { phase: p, runId });

    // Get FRESH analysis state for prior context (includes newly regenerated earlier phases)
    const freshAnalysis = entityGraphService.getAnalysis();

    // Build prior context from entities in earlier completed phases
    const completedPhases = RUNNABLE_PHASES.slice(
      0,
      RUNNABLE_PHASES.indexOf(p),
    );
    const priorEntities = freshAnalysis.entities
      .filter((e) => completedPhases.includes(e.phase))
      .map((e) => ({
        id: e.id,
        type: e.type,
        name:
          "name" in e.data
            ? e.data.name
            : "content" in e.data
              ? e.data.content
              : e.id,
        phase: e.phase,
      }));
    const priorContext =
      priorEntities.length > 0 ? JSON.stringify(priorEntities) : undefined;

    // Objections against this phase's entities are injected into the prompt
    // (9A) and resolved against the re-run outcome after the commit (2.2A).
    const phaseChallenges = pendingChallengesForPhase(p);
    const challengedEntityIds = new Set(
      phaseChallenges.map((challenge) => challenge.entityId),
    );
    const challengeContext = buildChallengeContext(phaseChallenges);

    const phaseStart = Date.now();
    let result = await runPhase(p, topic, {
      provider: lastRunProvider,
      model: lastRunModel,
      runtime: lastRunRuntime,
      priorEntities: priorContext,
      challengeContext,
      logger,
      runId,
    });

    if (result.success) {
      try {
        if (
          await dropStaleCommitIfNeeded(runId, p, capturedEpoch, logger)
        ) {
          return;
        }

        let commitResult = commitPhaseSnapshot({
          phase: p,
          runId,
          entities: result.entities,
          relationships: result.relationships,
          trigger: "revalidation",
          challengedEntityIds,
        });

        if (commitResult.status === "retry_required") {
          logger.warn("revalidation", "truncation-retry", {
            phase: p,
            originalAiEntityCount: commitResult.originalAiEntityCount,
            returnedAiEntityCount: commitResult.returnedAiEntityCount,
          });

          result = await runPhase(p, topic, {
            provider: lastRunProvider,
            model: lastRunModel,
            runtime: lastRunRuntime,
            priorEntities: priorContext,
            challengeContext,
            revisionRetryInstruction: commitResult.retryMessage,
            logger,
            runId,
          });

          if (!result.success) {
            const error = result.error ?? "Revalidation phase failed";
            setRevalRunStatus(runId, {
              runId,
              status: "failed",
              phasesCompleted,
              error,
            });
            runtimeStatus.releaseRun(runId, "failed", {
              failedPhase: p,
              failureMessage: error,
            });
            emitProgress({
              type: "analysis_failed",
              runId,
              error,
            });
            return;
          }

          if (
            await dropStaleCommitIfNeeded(runId, p, capturedEpoch, logger)
          ) {
            return;
          }

          commitResult = commitPhaseSnapshot({
            phase: p,
            runId,
            entities: result.entities,
            relationships: result.relationships,
            allowLargeReductionCommit: true,
            trigger: "revalidation",
            challengedEntityIds,
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

        resolveChallengesAfterRerun(phaseChallenges, runId);

        phasesCompleted++;
        setRevalRunStatus(runId, {
          runId,
          status: "running",
          phasesCompleted,
        });
        runtimeStatus.completePhase(runId);

        emitProgress({
          type: "phase_completed",
          phase: p,
          runId,
          summary: {
            entitiesCreated: commitResult.summary.entitiesCreated,
            relationshipsCreated: commitResult.summary.relationshipsCreated,
            entitiesUpdated: commitResult.summary.entitiesUpdated,
            durationMs: Date.now() - phaseStart,
          },
        });
      } catch (err) {
        const error =
          err instanceof Error
            ? `Revision diff validation error: ${err.message}`
            : `Revision diff validation error: ${String(err)}`;
        setRevalRunStatus(runId, {
          runId,
          status: "failed",
          phasesCompleted,
          error,
        });
        runtimeStatus.releaseRun(runId, "failed", {
          failedPhase: p,
          failureMessage: error,
        });
        emitProgress({
          type: "analysis_failed",
          runId,
          error,
        });
        return;
      }
    } else {
      const error = result.error ?? "Revalidation phase failed";
      setRevalRunStatus(runId, {
        runId,
        status: "failed",
        phasesCompleted,
        error,
      });
      runtimeStatus.releaseRun(runId, "failed", {
        failedPhase: p,
        failureMessage: error,
      });
      emitProgress({
        type: "analysis_failed",
        runId,
        error,
      });
      return;
    }
  }

  // Challenges whose entity no longer exists at all (deleted by an earlier
  // phase's cascade rather than its own re-run) resolve as REMOVED.
  resolveChallengesAfterRerun(
    entityGraphService
      .getPendingChallenges()
      .filter(
        (challenge) =>
          entityGraphService.getEntityById(challenge.entityId) === null,
      ),
    runId,
  );

  setRevalRunStatus(runId, {
    runId,
    status: "completed",
    phasesCompleted,
  });
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

export function isRevalidating(): boolean {
  return getRunningRevalStatus() !== null;
}

export function cancelActiveRevalidation(): RevalRunStatus | null {
  const active = getRunningRevalStatus();
  if (!active) {
    return null;
  }

  const aborted: RevalRunStatus = {
    ...active,
    status: "aborted",
    error: "Cancelled by new analysis",
  };
  setRevalRunStatus(active.runId, aborted);
  runtimeStatus.releaseRun(active.runId, "cancelled");
  serverWarn(active.runId, "revalidation", "cancelled", {
    reason: "new-analysis",
  });
  return aborted;
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
  if (provider !== undefined) lastRunProvider = provider;
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
