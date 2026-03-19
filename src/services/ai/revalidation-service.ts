// revalidation-service.ts — cascade invalidation with debounced auto-trigger.
// Listens for stale_marked events from entity-graph-service,
// debounces for 2s, then re-runs phases from the earliest stale one.
// Suppressed during active analysis runs; deferred staleIds revalidate on run complete.

import type { MethodologyPhase } from "@/types/methodology";
import { V1_PHASES, PHASE_NUMBERS } from "@/types/methodology";
import * as entityGraphService from "@/services/ai/entity-graph-service";
import * as orchestrator from "@/services/ai/analysis-orchestrator";
import { runPhase } from "@/services/ai/analysis-service";
import type { AnalysisProgressEvent } from "@/services/ai/analysis-events";
import { createRunLogger, timer } from "./ai-logger";

// ── Constants ──

const DEBOUNCE_MS = 2000;

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
let deferredStaleIds = new Set<string>();
const progressListeners = new Set<(event: AnalysisProgressEvent) => void>();
let unsubscribeMutation: (() => void) | null = null;
const revalRunStatuses = new Map<string, RevalRunStatus>();

/** Provider/model from the most recent analysis run, used for revalidation continuity. */
let lastRunProvider: string | undefined;
let lastRunModel: string | undefined;

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
  const startIdx = V1_PHASES.indexOf(startPhase);
  if (startIdx === -1) return [];
  return V1_PHASES.slice(startIdx);
}

// ── Core API ──

/**
 * Schedule a debounced revalidation. If called again within 2s, resets the timer
 * and merges the new staleIds. If an analysis run is active, stores ids for
 * deferred revalidation after the run completes.
 */
export function scheduleRevalidation(staleIds: string[]): void {
  const scheduleLogger = createRunLogger(`reval-sched-${Date.now()}`);
  scheduleLogger.log("revalidation", "scheduled", {
    staleIds,
  });

  // Merge into pending set
  for (const id of staleIds) {
    pendingStaleIds.add(id);
  }

  // If an analysis run is active, defer — don't start the timer
  if (orchestrator.isRunning()) {
    for (const id of staleIds) {
      deferredStaleIds.add(id);
    }
    scheduleLogger.log("revalidation", "suppressed", {
      deferredCount: deferredStaleIds.size,
    });
    return;
  }

  // Reset debounce timer
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    scheduleLogger.log("revalidation", "debounce-reset", {
      pendingCount: pendingStaleIds.size,
    });
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
    for (const id of ids) {
      deferredStaleIds.add(id);
    }
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
    revalRunStatuses.set(runId, {
      runId,
      status: "completed",
      phasesCompleted: 0,
    });
    return { runId };
  }

  // Register as running before async work begins
  revalRunStatuses.set(runId, { runId, status: "running", phasesCompleted: 0 });

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

  // Get the analysis topic for phase re-execution
  const analysis = entityGraphService.getAnalysis();
  const topic = analysis.topic;

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
    // Remove old phase-derived entities before re-running to prevent duplication
    // (user-edited and ai-edited entities are preserved by removePhaseEntities
    // when called without runId)
    entityGraphService.removePhaseEntities(p, undefined);

    emitProgress({ type: "phase_started", phase: p, runId });
    logger.log("revalidation", "phase-rerun", { phase: p, runId });

    // Build prior context from entities in earlier completed phases
    const completedPhases = V1_PHASES.slice(0, V1_PHASES.indexOf(p));
    const priorEntities = analysis.entities
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

    const phaseStart = Date.now();
    const result = await runPhase(p, topic, {
      provider: lastRunProvider,
      model: lastRunModel,
      priorEntities: priorContext,
      logger,
    });

    if (result.success) {
      // Clear stale on entities from this phase
      const phaseEntities = entityGraphService.getEntitiesByPhase(p);
      const phaseEntityIds = phaseEntities.map((e) => e.id);
      if (phaseEntityIds.length > 0) {
        entityGraphService.clearStale(phaseEntityIds);
      }

      // Store new entities, building an ID map for relationship remapping
      const idMap = new Map<string, string>();
      for (const entity of result.entities) {
        const created = entityGraphService.createEntity(
          {
            type: entity.type,
            phase: entity.phase,
            data: entity.data,
            position: entity.position,
            confidence: entity.confidence,
            source: entity.source,
            rationale: entity.rationale,
            revision: entity.revision,
            stale: entity.stale,
          },
          { source: "phase-derived", runId, phase: p },
        );
        if (entity.id) {
          idMap.set(entity.id, created.id);
        }
      }

      // H2 fix: recreate relationships from re-run phases with ID remapping
      for (const rel of result.relationships) {
        const fromId = idMap.get(rel.fromEntityId) ?? rel.fromEntityId;
        const toId = idMap.get(rel.toEntityId) ?? rel.toEntityId;
        try {
          entityGraphService.createRelationship({
            type: rel.type,
            fromEntityId: fromId,
            toEntityId: toId,
            metadata: rel.metadata,
          });
        } catch {
          // Relationship may fail if entity IDs reference entities from
          // a different phase that haven't been remapped in this batch.
        }
      }

      phasesCompleted++;
      revalRunStatuses.set(runId, {
        runId,
        status: "running",
        phasesCompleted,
      });

      emitProgress({
        type: "phase_completed",
        phase: p,
        runId,
        summary: {
          entitiesCreated: result.entities.length,
          relationshipsCreated: result.relationships.length,
          entitiesUpdated: 0,
          durationMs: Date.now() - phaseStart,
        },
      });
    } else {
      const error = result.error ?? "Revalidation phase failed";
      revalRunStatuses.set(runId, {
        runId,
        status: "failed",
        phasesCompleted,
        error,
      });
      emitProgress({
        type: "analysis_failed",
        runId,
        error,
      });
      return;
    }
  }

  revalRunStatuses.set(runId, { runId, status: "completed", phasesCompleted });

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

/**
 * Called by the orchestrator when a run finishes. Captures provider/model
 * for revalidation continuity. If there are pending staleIds from suppressed
 * revalidation, triggers revalidation now.
 */
export function onRunComplete(provider?: string, model?: string): void {
  if (provider !== undefined) lastRunProvider = provider;
  if (model !== undefined) lastRunModel = model;

  if (deferredStaleIds.size > 0) {
    const ids = Array.from(deferredStaleIds);
    deferredStaleIds.clear();
    pendingStaleIds.clear();
    revalidate(ids);
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
  deferredStaleIds.clear();
  progressListeners.clear();
  revalRunStatuses.clear();
  lastRunProvider = undefined;
  lastRunModel = undefined;
  unwire();
}

/** Expose pending stale IDs for test assertions. */
export function _getPendingStaleIds(): Set<string> {
  return pendingStaleIds;
}

/** Expose deferred stale IDs for test assertions. */
export function _getDeferredStaleIds(): Set<string> {
  return deferredStaleIds;
}
