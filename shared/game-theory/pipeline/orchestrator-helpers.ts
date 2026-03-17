import type { CanonicalStore } from "../types";
import type { RevalidationEvent } from "../types/evidence";
import type {
  PendingRevalidationApproval,
  PhaseExecution,
  PhaseRunInput,
  Phase6RunInput,
  PipelinePhaseStatus,
  RevalidationCheck,
} from "../types/analysis-pipeline";
import type { RevalidationActionCard } from "../types/conversation";
import type { PipelineHost } from "./host";
import type { Phase1Input } from "./phase-1-grounding";
import type { Phase2Input } from "./phase-2-players";
import { getActivePrompt } from "./prompt-registry";
import { createEntityId } from "./helpers";

export const PHASE_NAMES: Record<number, string> = {
  1: "Situational Grounding",
  2: "Player Identification",
  3: "Baseline Strategic Model",
  4: "Historical Repeated Game",
  5: "Recursive Revalidation",
  6: "Full Formalization",
  7: "Assumption Extraction",
  8: "Elimination",
  9: "Scenario Generation",
  10: "Meta-check",
};

export function readPromptRegistry(host: PipelineHost) {
  return host.getPipelineRuntimeState().prompt_registry;
}

export function createPhaseExecution(
  host: PipelineHost,
  phase: number,
): PhaseExecution {
  const prompt = getActivePrompt(readPromptRegistry(host), phase);
  return {
    id: createEntityId("phase_execution"),
    phase,
    pass_number: host.getPipelineState().analysis_state?.pass_number ?? 1,
    provider_id: "browser-fallback",
    model_id: "heuristic-m6",
    prompt_version_id: prompt.id,
    started_at: new Date().toISOString(),
    completed_at: null,
    duration_ms: null,
    input_tokens: 0,
    output_tokens: 0,
    cost_usd: null,
    status: "running",
    error: null,
  };
}

export function setPhaseRunning(
  host: PipelineHost,
  phase: number,
  executionId: string,
): void {
  const now = new Date().toISOString();
  const activeCycle = host.getPipelineRuntimeState().active_rerun_cycle;
  if (activeCycle && activeCycle.target_phases.includes(phase)) {
    host.setActiveRerunCycle({
      ...activeCycle,
      status: "running",
    });
  }

  host.updateAnalysisState((analysisState) => {
    if (!analysisState) {
      return analysisState;
    }

    return {
      ...analysisState,
      current_phase: phase,
      status: "running",
      phase_states: {
        ...analysisState.phase_states,
        [phase]: {
          ...analysisState.phase_states[phase],
          status: "running",
          started_at: now,
          pass_number: analysisState.pass_number,
          phase_execution_id: executionId,
        },
      },
    };
  });
}

export function setPhaseFinished(
  host: PipelineHost,
  phase: number,
  executionId: string,
  status: Extract<
    PipelinePhaseStatus,
    "review_needed" | "complete" | "needs_rerun"
  >,
  paused = true,
): void {
  const now = new Date().toISOString();
  host.updateAnalysisState((analysisState) => {
    if (!analysisState) {
      return analysisState;
    }

    return {
      ...analysisState,
      current_phase: null,
      status: paused ? "paused" : "running",
      phase_states: {
        ...analysisState.phase_states,
        [phase]: {
          ...analysisState.phase_states[phase],
          status,
          completed_at: now,
          phase_execution_id: executionId,
        },
      },
    };
  });
}

export function readPhase1Input(
  input?: PhaseRunInput,
): Pick<Phase1Input, "focus_areas"> {
  return input && "focus_areas" in input
    ? { focus_areas: input.focus_areas }
    : {};
}

export function readPhase2Input(input?: PhaseRunInput): Phase2Input {
  return input && "additional_context" in input
    ? { additional_context: input.additional_context }
    : {};
}

export function readPhase6Input(input?: PhaseRunInput): Phase6RunInput {
  return input && "subsections" in input
    ? { subsections: input.subsections }
    : {};
}

export function requirePhasePrerequisite(
  host: PipelineHost,
  phase: number,
): void {
  if (phase === 5) {
    return;
  }

  const blockingPhase = host.getFirstPendingProposalPhase(phase);
  if (blockingPhase != null) {
    throw new Error(
      `Phase ${blockingPhase} proposals are still pending review.`,
    );
  }

  if (phase === 1) {
    return;
  }

  const analysisState = host.getPipelineState().analysis_state;
  if (!analysisState) {
    throw new Error(
      `Phase ${phase - 1} (${PHASE_NAMES[phase - 1]}) must be completed first.`,
    );
  }

  const priorState = analysisState.phase_states[phase - 1];
  const phaseReady =
    priorState?.status === "complete" || priorState?.status === "review_needed";
  if (!priorState || !phaseReady) {
    throw new Error(
      `Phase ${phase - 1} (${PHASE_NAMES[phase - 1]}) must be completed first.`,
    );
  }
}

function sameTargets(left: number[], right: number[]): boolean {
  const leftSorted = [...left].sort((a, b) => a - b);
  const rightSorted = [...right].sort((a, b) => a - b);
  return (
    leftSorted.length === rightSorted.length &&
    leftSorted.every((value, index) => value === rightSorted[index])
  );
}

function sameRefs(
  left: ReadonlyArray<{ type: string; id: string }>,
  right: ReadonlyArray<{ type: string; id: string }>,
): boolean {
  const normalize = (refs: ReadonlyArray<{ type: string; id: string }>) =>
    refs.map((ref) => `${ref.type}:${ref.id}`).sort();
  const leftKeys = normalize(left);
  const rightKeys = normalize(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((value, index) => value === rightKeys[index])
  );
}

export function buildRevalidationActionCard(
  event: RevalidationEvent,
): RevalidationActionCard {
  return {
    event_id: event.id,
    trigger_condition: event.trigger_condition,
    source_phase: event.source_phase,
    target_phases: event.target_phases,
    description: event.description,
    pass_number: event.pass_number,
    resolution: event.resolution,
    entity_refs: event.entity_refs,
  };
}

export function findMatchingOpenEvent(
  trigger: RevalidationEvent["trigger_condition"],
  phase: number,
  affectedPhases: number[],
  affectedEntities: RevalidationCheck["affected_entities"],
  canonical: CanonicalStore,
): RevalidationEvent | null {
  return (
    Object.values(canonical.revalidation_events).find(
      (event) =>
        (event.resolution === "pending" || event.resolution === "approved") &&
        event.source_phase === phase &&
        event.trigger_condition === trigger &&
        sameTargets(event.target_phases, affectedPhases) &&
        sameRefs(event.entity_refs, affectedEntities),
    ) ?? null
  );
}

export function markPhasesForRerun(
  host: PipelineHost,
  phases: number[],
): Partial<Record<number, PipelinePhaseStatus>> {
  const previousStatuses: Partial<Record<number, PipelinePhaseStatus>> = {};

  host.updateAnalysisState((analysisState) => {
    if (!analysisState) {
      return analysisState;
    }

    const phase_states = { ...analysisState.phase_states };
    for (const phase of phases) {
      const current = phase_states[phase];
      if (!current) {
        continue;
      }
      previousStatuses[phase] = current.status;
      phase_states[phase] = {
        ...current,
        status: "needs_rerun",
      };
    }

    return {
      ...analysisState,
      current_phase: null,
      status: "paused",
      phase_states,
    };
  });

  return previousStatuses;
}

export function restorePhaseStatuses(
  host: PipelineHost,
  previousStatuses: Partial<Record<number, PipelinePhaseStatus>>,
  preservedPhases: ReadonlySet<number>,
): void {
  host.updateAnalysisState((analysisState) => {
    if (!analysisState) {
      return analysisState;
    }

    const phase_states = { ...analysisState.phase_states };
    for (const [phaseKey, status] of Object.entries(previousStatuses)) {
      const phase = Number(phaseKey);
      if (!phase_states[phase] || !status || preservedPhases.has(phase)) {
        continue;
      }
      phase_states[phase] = {
        ...phase_states[phase],
        status,
      };
    }

    return {
      ...analysisState,
      phase_states,
    };
  });
}

export type { PendingRevalidationApproval };
