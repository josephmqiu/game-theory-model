/**
 * Pipeline store — merged pipeline + pipeline-runtime state.
 * Tracks AI pipeline analysis state, phase executions, results, and runtime config.
 */

import { createStore, useStore } from "zustand";
import type {
  ActiveRerunCycle,
  AnalysisState as PipelineAnalysisState,
  ClassificationResult,
  PhaseExecution,
  PhaseResult,
  PendingRevalidationApproval,
  PromptRegistry,
} from "shared/game-theory/types/analysis-pipeline";
import type { DiffReviewState } from "shared/game-theory/types/conversation";

export interface PipelineState {
  // Pipeline state
  analysis_state: PipelineAnalysisState | null;
  phase_executions: Record<string, PhaseExecution>;
  phase_results: Record<number, PhaseResult | unknown>;
  steering_messages: Array<{ id: string; content: string; timestamp: string }>;
  proposal_review: DiffReviewState | null;

  // Runtime state
  prompt_registry: PromptRegistry;
  pending_revalidation_approvals: Record<string, PendingRevalidationApproval>;
  active_rerun_cycle: ActiveRerunCycle | null;
}

interface PipelineActions {
  startPipelineAnalysis: (params: {
    analysisId: string;
    description: string;
    domain: string;
    classification: ClassificationResult | null;
  }) => PipelineAnalysisState;
  updateAnalysisState: (
    updater: (
      state: PipelineAnalysisState | null,
    ) => PipelineAnalysisState | null,
  ) => void;
  setPhaseResult: (phase: number, result: PhaseResult | unknown) => void;
  upsertPhaseExecution: (execution: PhaseExecution) => void;
  setPipelineProposalReview: (review: DiffReviewState) => void;
  addSteeringMessage: (content: string) => void;
  updatePromptRegistry: (
    updater: (registry: PromptRegistry) => PromptRegistry,
  ) => void;
  registerPendingRevalidationApproval: (
    approval: PendingRevalidationApproval,
  ) => void;
  clearPendingRevalidationApproval: (eventId: string) => void;
  setActiveRerunCycle: (cycle: ActiveRerunCycle | null) => void;
  resetPipeline: () => void;
}

type PipelineStore = PipelineState & PipelineActions;

function createInitialState(): PipelineState {
  return {
    analysis_state: null,
    phase_executions: {},
    phase_results: {},
    steering_messages: [],
    proposal_review: null,
    prompt_registry: {
      versions: {},
      active_versions: {},
      official_versions: {},
    },
    pending_revalidation_approvals: {},
    active_rerun_cycle: null,
  };
}

export const pipelineStore = createStore<PipelineStore>((set, get) => ({
  ...createInitialState(),

  startPipelineAnalysis(params) {
    const analysisId = params.analysisId || crypto.randomUUID();
    const analysisState: PipelineAnalysisState = {
      id: analysisId,
      event_description: params.description,
      domain: params.domain,
      current_phase: null,
      phase_states: {},
      pass_number: 1,
      status: "running",
      started_at: new Date().toISOString(),
      completed_at: null,
      classification: params.classification,
    };
    set({
      analysis_state: analysisState,
      phase_executions: {},
      phase_results: {},
      steering_messages: [],
    });
    return analysisState;
  },

  updateAnalysisState(updater) {
    const current = get().analysis_state;
    const next = updater(current);
    if (next !== current) {
      set({ analysis_state: next });
    }
  },

  setPhaseResult(phase, result) {
    set({ phase_results: { ...get().phase_results, [phase]: result } });
  },

  upsertPhaseExecution(execution) {
    set({
      phase_executions: {
        ...get().phase_executions,
        [execution.id]: execution,
      },
    });
  },

  setPipelineProposalReview(review) {
    set({ proposal_review: review });
  },

  addSteeringMessage(content) {
    set({
      steering_messages: [
        ...get().steering_messages,
        {
          id: crypto.randomUUID(),
          content,
          timestamp: new Date().toISOString(),
        },
      ],
    });
  },

  updatePromptRegistry(updater) {
    set({ prompt_registry: updater(get().prompt_registry) });
  },

  registerPendingRevalidationApproval(approval) {
    set({
      pending_revalidation_approvals: {
        ...get().pending_revalidation_approvals,
        [approval.event_id]: approval,
      },
    });
  },

  clearPendingRevalidationApproval(eventId) {
    const { [eventId]: _removed, ...rest } =
      get().pending_revalidation_approvals;
    set({ pending_revalidation_approvals: rest });
  },

  setActiveRerunCycle(cycle) {
    set({ active_rerun_cycle: cycle });
  },

  resetPipeline() {
    set(createInitialState());
  },
}));

export function usePipelineStore<T>(selector: (state: PipelineStore) => T): T {
  return useStore(pipelineStore, selector);
}

export function getPipelineStoreState(): PipelineState {
  return pipelineStore.getState();
}
