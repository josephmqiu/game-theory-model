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

// ── Constants ──

const DEBOUNCE_MS = 2000;

// ── Module-level state ──

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingStaleIds = new Set<string>();
let deferredStaleIds = new Set<string>();
const progressListeners = new Set<(event: AnalysisProgressEvent) => void>();
let unsubscribeMutation: (() => void) | null = null;

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
  // Merge into pending set
  for (const id of staleIds) {
    pendingStaleIds.add(id);
  }

  // If an analysis run is active, defer — don't start the timer
  if (orchestrator.isRunning()) {
    for (const id of staleIds) {
      deferredStaleIds.add(id);
    }
    return;
  }

  // Reset debounce timer
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

/**
 * Run revalidation. Determines which phases need re-running from entity provenance
 * (or uses the explicit phase parameter), then re-runs from the earliest stale phase
 * through the end of the pipeline.
 */
export async function revalidate(
  staleEntityIds?: string[],
  phase?: string,
): Promise<{ runId: string }> {
  const runId = `reval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Determine starting phase
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
    return { runId };
  }

  // Get the analysis topic for phase re-execution
  const analysis = entityGraphService.getAnalysis();
  const topic = analysis.topic;

  // Re-run from the earliest stale phase through the end
  const phases = phasesFrom(startPhase);

  for (const p of phases) {
    // Remove old entities before re-running to prevent duplication
    entityGraphService.removePhaseEntities(p, undefined);

    emitProgress({ type: "phase_started", phase: p, runId });

    const phaseStart = Date.now();
    const result = await runPhase(p, topic);

    if (result.success) {
      // Clear stale on entities from this phase
      const phaseEntities = entityGraphService.getEntitiesByPhase(p);
      const phaseEntityIds = phaseEntities.map((e) => e.id);
      if (phaseEntityIds.length > 0) {
        entityGraphService.clearStale(phaseEntityIds);
      }

      // Store new entities
      for (const entity of result.entities) {
        entityGraphService.createEntity(
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
      }

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
      emitProgress({
        type: "analysis_failed",
        runId,
        error: result.error ?? "Revalidation phase failed",
      });
      break;
    }
  }

  return { runId };
}

/**
 * Called by the orchestrator when a run finishes. If there are pending staleIds
 * from suppressed revalidation, triggers revalidation now.
 */
export function onRunComplete(): void {
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
