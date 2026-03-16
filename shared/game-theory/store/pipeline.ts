// Test-compatible in-memory stub for pipeline state used by pipeline tests.
// Production code uses src/stores/pipeline-store.ts (Zustand) instead.

import type {
  AnalysisState,
  PhaseExecution,
  PhaseState,
  SteeringMessage,
} from "../types/analysis-pipeline.ts";
import type { DiffReviewState, ProposalGroup } from "../types/conversation.ts";

interface PipelineState {
  activeAnalysisId: string | null;
  analysis_state: AnalysisState | null;
  phase_executions: Record<string, PhaseExecution>;
  phase_results: Record<number, unknown>;
  steering_messages: SteeringMessage[];
  proposal_review: DiffReviewState;
}

function createEmptyDiffReviewState(): DiffReviewState {
  return {
    proposals: [],
    active_proposal_index: 0,
    merge_log: [],
  };
}

function createPhaseStates(): Record<number, PhaseState> {
  return Object.fromEntries(
    Array.from({ length: 10 }, (_, index) => {
      const phase = index + 1;
      return [
        phase,
        {
          phase,
          status: "pending",
          pass_number: 1,
          started_at: null,
          completed_at: null,
          phase_execution_id: null,
        } satisfies PhaseState,
      ];
    }),
  ) as Record<number, PhaseState>;
}

function createInitialState(): PipelineState {
  return {
    activeAnalysisId: null,
    analysis_state: null,
    phase_executions: {},
    phase_results: {},
    steering_messages: [],
    proposal_review: createEmptyDiffReviewState(),
  };
}

let state: PipelineState = createInitialState();

export function resetPipelineStore(): void {
  state = createInitialState();
}

export function getPipelineState(): PipelineState {
  return state;
}

export function startPipelineAnalysis(params: {
  analysisId: string;
  description: string;
  domain: string;
  classification: AnalysisState["classification"];
}): AnalysisState {
  const now = new Date().toISOString();
  const analysisState: AnalysisState = {
    id: params.analysisId,
    event_description: params.description,
    domain: params.domain,
    current_phase: null,
    phase_states: createPhaseStates(),
    pass_number: 1,
    status: "not_started",
    started_at: now,
    completed_at: null,
    classification: params.classification ?? null,
  };

  state = {
    ...state,
    activeAnalysisId: params.analysisId,
    analysis_state: analysisState,
    phase_executions: {},
    phase_results: {},
    steering_messages: [],
  };

  return analysisState;
}

export function updateAnalysisState(
  updater: (state: AnalysisState | null) => AnalysisState | null,
): void {
  state = {
    ...state,
    analysis_state: updater(state.analysis_state),
  };
}

export function upsertPhaseExecution(execution: PhaseExecution): void {
  state = {
    ...state,
    phase_executions: {
      ...state.phase_executions,
      [execution.id]: execution,
    },
  };
}

export function setPhaseResult(phase: number, result: unknown): void {
  state = {
    ...state,
    phase_results: {
      ...state.phase_results,
      [phase]: result,
    },
  };
}

export function setPipelineProposalReview(
  proposalReview: DiffReviewState,
): void {
  state = {
    ...state,
    proposal_review: proposalReview,
  };
}

export function syncPipelineReviewStatuses(
  _proposalGroups: ReadonlyArray<ProposalGroup>,
): void {
  // No-op in test stub -- production Zustand store syncs phase statuses
  // based on pending proposal groups. Tests set phase_states directly.
}

export function addSteeringMessage(content: string): SteeringMessage {
  const message: SteeringMessage = {
    id: `steering_${crypto.randomUUID()}`,
    content,
    timestamp: new Date().toISOString(),
  };

  state = {
    ...state,
    steering_messages: [...state.steering_messages, message],
  };

  return message;
}
