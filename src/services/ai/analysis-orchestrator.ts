// analysis-orchestrator.ts — run lifecycle, retry, edit queueing, progress events.
// Calls analysis-service.runPhase() per phase. Does NOT call streamChat directly.
// Consolidates analysis-run-store state into module-level singleton.

import type { MethodologyPhase } from "@/types/methodology";
import { V1_PHASES } from "@/types/methodology";
import type { AnalysisEntity, AnalysisRelationship } from "@/types/entity";
import type { PhaseResult } from "@/services/ai/analysis-service";
import { runPhase } from "@/services/ai/analysis-service";
import * as entityGraphService from "@/services/ai/entity-graph-service";
import type {
  AnalysisProgressEvent,
  PhaseSummary,
} from "@/services/ai/analysis-events";
import * as revalidationService from "@/services/ai/revalidation-service";

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

interface ActiveRun {
  runId: string;
  status: RunStatusValue;
  activePhase: MethodologyPhase | null;
  provider?: string;
  model?: string;
  editQueue: Array<() => void>;
  startTime: number;
  phasesCompleted: MethodologyPhase[];
  abortController: AbortController;
  error?: string;
}

// ── Constants ──

type SupportedPhase = Extract<
  MethodologyPhase,
  "situational-grounding" | "player-identification" | "baseline-model"
>;

const SUPPORTED_PHASES: SupportedPhase[] = V1_PHASES.filter(
  (p): p is SupportedPhase =>
    p === "situational-grounding" ||
    p === "player-identification" ||
    p === "baseline-model",
);

const MAX_RETRIES = 2;
const PHASE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
const RUN_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

// ── Module-level state ──

let activeRun: ActiveRun | null = null;
let runPromise: Promise<void> | null = null;
const progressListeners = new Set<(event: AnalysisProgressEvent) => void>();

/** Capped snapshot store: completed run results keyed by runId */
const MAX_RESULT_SNAPSHOTS = 10;
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

// ── Retry classification ──

export function classifyFailure(error: string): FailureClass {
  // Only these specific patterns are retryable
  if (/connect|ECONNR|network|socket|EPIPE/i.test(error)) return "retryable"; // transport
  if (/empty.*(response|output)|no.*(content|output|text)/i.test(error))
    return "retryable"; // empty
  if (/parse|json|syntax|zod|validation/i.test(error)) return "retryable"; // parse
  // Everything else is terminal (timeout, auth, schema refusal, unknown)
  return "terminal";
}

// ── Edit queue ──

function drainEditQueue(): void {
  if (!activeRun) return;
  const queue = activeRun.editQueue.splice(0);
  for (const mutation of queue) {
    try {
      mutation();
    } catch {
      // Edit errors must not break orchestrator flow
    }
  }
}

// ── Prior context builder ──

function buildPriorContext(
  completedPhases: MethodologyPhase[],
): string | undefined {
  if (completedPhases.length === 0) return undefined;

  const analysis = entityGraphService.getAnalysis();
  const priorEntities = analysis.entities.filter((e) =>
    completedPhases.includes(e.phase),
  );

  if (priorEntities.length === 0) return undefined;

  const summary = priorEntities.map((e) => ({
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

  return JSON.stringify(summary);
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
  entityGraphService.setPhaseStatus(phase, "running");
  emitProgress({ type: "phase_started", phase, runId: run.runId });

  const priorContext = buildPriorContext(run.phasesCompleted);

  let lastError = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Check abort before each attempt
    if (externalSignal?.aborted) {
      entityGraphService.setPhaseStatus(phase, "pending");
      return { success: false, error: "Aborted" };
    }

    // Check run-level timeout before each attempt
    if (Date.now() - run.startTime >= RUN_TIMEOUT_MS) {
      entityGraphService.setPhaseStatus(phase, "failed");
      return { success: false, error: "Run-level timeout exceeded" };
    }

    // Clear-before-retry: remove entities from the prior failed attempt
    if (attempt > 0) {
      entityGraphService.removePhaseEntities(phase, run.runId);
    }

    // Per-phase timeout via AbortController
    const phaseAbort = new AbortController();
    const phaseTimer = setTimeout(() => phaseAbort.abort(), PHASE_TIMEOUT_MS);

    // Also abort if external signal fires
    const onExternalAbort = () => phaseAbort.abort();
    externalSignal?.addEventListener("abort", onExternalAbort, { once: true });

    let result: PhaseResult;
    try {
      result = await Promise.race([
        runPhase(phase, topic, {
          priorEntities: priorContext,
          provider: run.provider,
          model: run.model,
          signal: phaseAbort.signal,
        }),
        new Promise<PhaseResult>((_, reject) => {
          phaseAbort.signal.addEventListener("abort", () => {
            reject(new Error("Phase timeout"));
          });
        }),
      ]);
    } catch (err) {
      clearTimeout(phaseTimer);
      externalSignal?.removeEventListener("abort", onExternalAbort);

      if (externalSignal?.aborted) {
        entityGraphService.setPhaseStatus(phase, "pending");
        return { success: false, error: "Aborted" };
      }

      lastError = err instanceof Error ? err.message : String(err);
      const classification = classifyFailure(lastError);
      if (classification === "terminal") {
        entityGraphService.setPhaseStatus(phase, "failed");
        return { success: false, error: lastError };
      }
      continue;
    } finally {
      clearTimeout(phaseTimer);
      externalSignal?.removeEventListener("abort", onExternalAbort);
    }

    if (result.success) {
      // Store entities via entity-graph-service, building an ID mapping
      // (AI-provided ID → service-generated ID) so relationships can be remapped.
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
          { source: "phase-derived", runId: run.runId, phase },
        );
        if (entity.id) {
          idMap.set(entity.id, created.id);
        }
      }
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
          // Relationship may still fail if entity IDs reference entities from
          // a different phase that haven't been remapped in this batch.
        }
      }

      entityGraphService.setPhaseStatus(phase, "complete");

      const summary: PhaseSummary = {
        entitiesCreated: result.entities.length,
        relationshipsCreated: result.relationships.length,
        entitiesUpdated: 0,
        durationMs: Date.now() - phaseStart,
      };
      emitProgress({
        type: "phase_completed",
        phase,
        runId: run.runId,
        summary,
      });

      // Drain edit queue after each successful phase
      drainEditQueue();

      return { success: true };
    }

    // Parse/validation failure — check classification
    lastError = result.error ?? "Unknown validation error";
    const classification = classifyFailure(lastError);
    if (classification === "terminal") {
      entityGraphService.setPhaseStatus(phase, "failed");
      return { success: false, error: lastError };
    }
    // Retryable — continue loop
  }

  // Exhausted retries
  entityGraphService.setPhaseStatus(phase, "failed");
  return { success: false, error: lastError };
}

// ── Public API ──

export async function runFull(
  topic: string,
  provider?: string,
  model?: string,
  signal?: AbortSignal,
): Promise<{ runId: string }> {
  // Guard: check both status AND whether the async execution is still unwinding
  if (activeRun && activeRun.status === "running") {
    throw new Error("A run is already active");
  }
  if (runPromise !== null) {
    throw new Error("A run is already active");
  }

  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const abortController = new AbortController();

  // Run-level timeout: create a signal that fires after RUN_TIMEOUT_MS
  const runTimeoutSignal = AbortSignal.timeout(RUN_TIMEOUT_MS);

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
    status: "running",
    activePhase: null,
    provider,
    model,
    editQueue: [],
    startTime: Date.now(),
    phasesCompleted: [],
    abortController,
  };

  // Execute phases async — don't await here, return immediately
  const run = activeRun;
  const executeAsync = async () => {
    try {
      for (const phase of SUPPORTED_PHASES) {
        if (run.status !== "running") break;

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
              emitProgress({
                type: "analysis_failed",
                runId: run.runId,
                error: "Run-level timeout exceeded",
              });
            } else {
              run.status = "interrupted";
              run.error = "Run was aborted";
            }
          } else {
            run.status = "failed";
            run.error = result.error;
            emitProgress({
              type: "analysis_failed",
              runId: run.runId,
              error: result.error ?? "Unknown error",
            });
          }
          break;
        }

        run.phasesCompleted.push(phase);
      }

      if (run.status === "running") {
        run.status = "completed";
        run.activePhase = null;

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
      }
    } finally {
      // Drain any remaining queued edits
      drainEditQueue();
      run.activePhase = null;
      // Clear runPromise so new runs can start
      runPromise = null;
      // Flush deferred revalidations that were suppressed during this run
      revalidationService.onRunComplete();
    }
  };

  // Track the async execution so concurrent run guard works
  runPromise = executeAsync();

  return { runId };
}

export function getStatus(runId: string): RunStatus {
  if (!activeRun || activeRun.runId !== runId) {
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
    totalPhases: SUPPORTED_PHASES.length,
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
    activeRun.status = "failed";
    activeRun.error = "Run interrupted (app restart)";
    activeRun.activePhase = null;
  }
}

// ── Testing ──

/** Reset all module state. Only for use in tests. */
export function _resetForTest(): void {
  activeRun = null;
  runPromise = null;
  progressListeners.clear();
  resultSnapshots.clear();
}

/** Expose activeRun for test assertions. */
export function _getActiveRun(): ActiveRun | null {
  return activeRun;
}

/** Expose runPromise for test assertions. */
export function _getRunPromise(): Promise<void> | null {
  return runPromise;
}
