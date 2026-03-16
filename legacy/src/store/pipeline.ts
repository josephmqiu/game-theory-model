import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'

import type {
  AnalysisState,
  PhaseExecution,
  PhaseState,
  SteeringMessage,
} from '../types/analysis-pipeline'
import type { DiffReviewState, ProposalGroup } from '../types/conversation'
import { createBrowserPersistenceAdapter } from './persistence'

interface PipelineSnapshot {
  analysis_state: AnalysisState | null
  phase_executions: Record<string, PhaseExecution>
  phase_results: Record<number, unknown>
  steering_messages: SteeringMessage[]
  proposal_review: DiffReviewState
}

interface PipelineState extends PipelineSnapshot {
  activeAnalysisId: string | null
}

const persistence = createBrowserPersistenceAdapter<PipelineSnapshot>('m5:pipeline')

function createEmptyDiffReviewState(): DiffReviewState {
  return {
    proposals: [],
    active_proposal_index: 0,
    merge_log: [],
  }
}

function createPhaseStates(): Record<number, PhaseState> {
  return Object.fromEntries(
    Array.from({ length: 10 }, (_, index) => {
      const phase = index + 1
      return [
        phase,
        {
          phase,
          status: 'pending',
          pass_number: 1,
          started_at: null,
          completed_at: null,
          phase_execution_id: null,
        } satisfies PhaseState,
      ]
    }),
  ) as Record<number, PhaseState>
}

function createInitialState(): PipelineState {
  return {
    activeAnalysisId: null,
    analysis_state: null,
    phase_executions: {},
    phase_results: {},
    steering_messages: [],
    proposal_review: createEmptyDiffReviewState(),
  }
}

function persistCurrentState(state: PipelineState): void {
  persistence.save(state.activeAnalysisId, {
    analysis_state: state.analysis_state,
    phase_executions: state.phase_executions,
    phase_results: state.phase_results,
    steering_messages: state.steering_messages,
    proposal_review: state.proposal_review,
  })
}

function loadSnapshot(analysisId: string | null): PipelineState {
  if (!analysisId) {
    return createInitialState()
  }

  const snapshot = persistence.load(analysisId)
  if (!snapshot) {
    return {
      ...createInitialState(),
      activeAnalysisId: analysisId,
    }
  }

  return {
    activeAnalysisId: analysisId,
    analysis_state: snapshot.analysis_state,
    phase_executions: snapshot.phase_executions,
    phase_results: snapshot.phase_results,
    steering_messages: snapshot.steering_messages,
    proposal_review: snapshot.proposal_review,
  }
}

const pipelineStore = createStore<PipelineState>(() => createInitialState())

export function setPipelineActiveAnalysis(analysisId: string | null): void {
  pipelineStore.setState(loadSnapshot(analysisId))
}

export function resetPipelineStore(): void {
  pipelineStore.setState(createInitialState())
}

export function usePipelineStore<T>(selector: (state: PipelineState) => T): T {
  return useStore(pipelineStore, selector)
}

export function getPipelineState(): PipelineState {
  return pipelineStore.getState()
}

export function startPipelineAnalysis(params: {
  analysisId: string
  description: string
  domain: string
  classification: AnalysisState['classification']
}): AnalysisState {
  const now = new Date().toISOString()
  const analysisState: AnalysisState = {
    id: params.analysisId,
    event_description: params.description,
    domain: params.domain,
    current_phase: null,
    phase_states: createPhaseStates(),
    pass_number: 1,
    status: 'not_started',
    started_at: now,
    completed_at: null,
    classification: params.classification ?? null,
  }

  pipelineStore.setState((state) => {
    const nextState = {
      ...state,
      activeAnalysisId: params.analysisId,
      analysis_state: analysisState,
      phase_executions: {},
      phase_results: {},
      steering_messages: [],
    }
    persistCurrentState(nextState)
    return nextState
  })

  return analysisState
}

export function updateAnalysisState(updater: (state: AnalysisState | null) => AnalysisState | null): void {
  pipelineStore.setState((state) => {
    const nextState = {
      ...state,
      analysis_state: updater(state.analysis_state),
    }
    persistCurrentState(nextState)
    return nextState
  })
}

export function upsertPhaseExecution(execution: PhaseExecution): void {
  pipelineStore.setState((state) => {
    const nextState = {
      ...state,
      phase_executions: {
        ...state.phase_executions,
        [execution.id]: execution,
      },
    }
    persistCurrentState(nextState)
    return nextState
  })
}

export function setPhaseResult(phase: number, result: unknown): void {
  pipelineStore.setState((state) => {
    const nextState = {
      ...state,
      phase_results: {
        ...state.phase_results,
        [phase]: result,
      },
    }
    persistCurrentState(nextState)
    return nextState
  })
}

export function setPipelineProposalReview(proposalReview: DiffReviewState): void {
  pipelineStore.setState((state) => {
    const nextState = {
      ...state,
      proposal_review: proposalReview,
    }
    persistCurrentState(nextState)
    return nextState
  })
}

export function syncPipelineReviewStatuses(proposalGroups: ReadonlyArray<ProposalGroup>): void {
  const pendingPhases = new Set(
    proposalGroups
      .filter((group) => group.proposals.some((proposal) => proposal.status === 'pending'))
      .map((group) => group.phase),
  )

  pipelineStore.setState((state) => {
    if (!state.analysis_state) {
      return state
    }

    let changed = false
    const phase_states = Object.fromEntries(
      Object.entries(state.analysis_state.phase_states).map(([phaseKey, phaseState]) => {
        const phaseNumber = Number(phaseKey)
        const shouldReview = pendingPhases.has(phaseNumber)
        let nextStatus = phaseState.status

        if (phaseState.status === 'complete' && shouldReview) {
          nextStatus = 'review_needed'
        } else if (phaseState.status === 'review_needed' && !shouldReview) {
          nextStatus = 'complete'
        }

        if (nextStatus !== phaseState.status) {
          changed = true
        }

        return [
          phaseKey,
          nextStatus === phaseState.status
            ? phaseState
            : {
                ...phaseState,
                status: nextStatus,
              } satisfies PhaseState,
        ]
      }),
    ) as Record<number, PhaseState>

    if (!changed) {
      return state
    }

    const nextState = {
      ...state,
      analysis_state: {
        ...state.analysis_state,
        phase_states,
      },
    }
    persistCurrentState(nextState)
    return nextState
  })
}

export function addSteeringMessage(content: string): SteeringMessage {
  const message: SteeringMessage = {
    id: `steering_${crypto.randomUUID()}`,
    content,
    timestamp: new Date().toISOString(),
  }

  pipelineStore.setState((state) => {
    const nextState = {
      ...state,
      steering_messages: [...state.steering_messages, message],
    }
    persistCurrentState(nextState)
    return nextState
  })

  return message
}
