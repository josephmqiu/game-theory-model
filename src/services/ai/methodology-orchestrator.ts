import type { MethodologyPhase } from "@/types/methodology";
import { V1_PHASES } from "@/types/methodology";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import { useAIStore } from "@/stores/ai-store";
import { generateCompletion } from "@/services/ai/ai-service";
import { createPhaseWorker } from "@/services/ai/phase-worker";

// ── Types ──

export interface OrchestratorCallbacks {
  onPhaseStart: (phase: MethodologyPhase) => void;
  onPhaseComplete: (phase: MethodologyPhase, entityCount: number) => void;
  onPhaseFailed: (phase: MethodologyPhase, error: string) => void;
  onComplete: () => void;
}

export interface OrchestratorConfig {
  topic: string;
  signal: AbortSignal;
  callbacks: OrchestratorCallbacks;
}

// ── Edit queue (applied between phases) ──
// External code can push edits here; the orchestrator drains them between phases.

type EditFn = () => void;
const editQueue: EditFn[] = [];

export function enqueueEdit(edit: EditFn): void {
  editQueue.push(edit);
}

function drainEditQueue(): void {
  while (editQueue.length > 0) {
    const edit = editQueue.shift()!;
    edit();
  }
}

// ── Prior context builder ──

function buildPriorContext(
  completedPhases: MethodologyPhase[],
): string | undefined {
  if (completedPhases.length === 0) return undefined;

  const store = useEntityGraphStore.getState();
  const priorEntities = store.analysis.entities.filter((e) =>
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

// ── Supported phases (matches phase-worker.ts) ──

type SupportedPhase = Extract<
  MethodologyPhase,
  "situational-grounding" | "player-identification" | "baseline-model"
>;

const SUPPORTED_PHASES: SupportedPhase[] = V1_PHASES as SupportedPhase[];

const DEFAULT_MODEL = "claude-sonnet-4-5-20250514";
const MAX_RETRIES = 2; // 2 retries = 3 total attempts

// ── Orchestrator ──

export async function runMethodologyAnalysis(
  config: OrchestratorConfig,
): Promise<void> {
  const { topic, signal, callbacks } = config;
  const completedPhases: MethodologyPhase[] = [];

  for (const phase of SUPPORTED_PHASES) {
    // Check abort before starting each phase
    if (signal.aborted) break;

    callbacks.onPhaseStart(phase);

    const store = useEntityGraphStore.getState();
    store.setPhaseStatus(phase, "running");

    const worker = createPhaseWorker(phase);
    const priorContext = buildPriorContext(completedPhases);
    const { system, user } = worker.buildPrompt(topic, priorContext);

    const model = useAIStore.getState().model || DEFAULT_MODEL;

    let succeeded = false;
    let lastError = "";

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // Check abort between retries
      if (signal.aborted) break;

      try {
        const raw = await generateCompletion(system, user, model);
        const result = worker.parseResponse(raw);

        if (result.success) {
          const { entities, relationships } = result.data;
          // Add entities + relationships to the store
          useEntityGraphStore.getState().addEntities(entities, relationships);
          useEntityGraphStore.getState().setPhaseStatus(phase, "complete");

          callbacks.onPhaseComplete(phase, entities.length);
          completedPhases.push(phase);
          succeeded = true;
          break;
        } else {
          lastError = result.error;
          // Parse failure — retry unless we've exhausted attempts
        }
      } catch (error) {
        // If aborted, exit cleanly without marking as failed
        if (signal.aborted) break;

        lastError = error instanceof Error ? error.message : "Unknown error";
        // Network/API failure — retry unless we've exhausted attempts
      }
    }

    // If aborted mid-phase, stop the loop
    if (signal.aborted) break;

    if (!succeeded) {
      useEntityGraphStore.getState().setPhaseStatus(phase, "failed");
      callbacks.onPhaseFailed(phase, lastError);
      // Stop the pipeline on phase failure — downstream phases depend on earlier output
      break;
    }

    // Drain any queued edits between phases
    drainEditQueue();
  }

  callbacks.onComplete();
}
