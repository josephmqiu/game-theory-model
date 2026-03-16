// Test-compatible in-memory stub for pipeline runtime state used by pipeline tests.
// Production code uses src/stores/pipeline-store.ts (Zustand) instead.

import type {
  ActiveRerunCycle,
  PendingRevalidationApproval,
  PromptRegistry,
} from "../types/analysis-pipeline.ts";
import { createDefaultPromptRegistry } from "../pipeline/prompt-registry.ts";

interface PipelineRuntimeState {
  activeAnalysisId: string | null;
  prompt_registry: PromptRegistry;
  pending_revalidation_approvals: Record<string, PendingRevalidationApproval>;
  active_rerun_cycle: ActiveRerunCycle | null;
}

function createInitialState(): PipelineRuntimeState {
  return {
    activeAnalysisId: null,
    prompt_registry: createDefaultPromptRegistry(),
    pending_revalidation_approvals: {},
    active_rerun_cycle: null,
  };
}

let state: PipelineRuntimeState = createInitialState();

export function resetPipelineRuntimeStore(): void {
  state = createInitialState();
}

export function getPipelineRuntimeState(): PipelineRuntimeState {
  return state;
}

export function registerPendingRevalidationApproval(
  pendingApproval: PendingRevalidationApproval,
): void {
  state = {
    ...state,
    pending_revalidation_approvals: {
      ...state.pending_revalidation_approvals,
      [pendingApproval.event_id]: pendingApproval,
    },
  };
}

export function clearPendingRevalidationApproval(eventId: string): void {
  if (!(eventId in state.pending_revalidation_approvals)) {
    return;
  }

  const { [eventId]: _removed, ...remaining } =
    state.pending_revalidation_approvals;

  state = {
    ...state,
    pending_revalidation_approvals: remaining,
  };
}

export function setActiveRerunCycle(cycle: ActiveRerunCycle | null): void {
  state = {
    ...state,
    active_rerun_cycle: cycle,
  };
}

export function updatePromptRegistry(
  updater: (registry: PromptRegistry) => PromptRegistry,
): void {
  state = {
    ...state,
    prompt_registry: updater(state.prompt_registry),
  };
}
