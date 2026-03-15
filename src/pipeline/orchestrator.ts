import type { DispatchResult } from '../engine/dispatch'
import type { Command } from '../engine/commands'
import type { CanonicalStore, CurrentAnalysisFile } from '../types'
import type {
  AnalysisState,
  EvidenceProposal,
  PhaseExecution,
  PhaseResult,
  PipelineOrchestrator,
} from '../types/analysis-pipeline'
import type { ConversationMessage } from '../types/conversation'
import { getConversationState, registerProposalGroup } from '../store/conversation'
import {
  addSteeringMessage,
  getPipelineState,
  setPhaseResult,
  setPipelineProposalReview,
  startPipelineAnalysis,
  updateAnalysisState,
  upsertPhaseExecution,
} from '../store/pipeline'
import { runPhase1Grounding, type Phase1Input } from './phase-1-grounding'
import { runPhase2Players, type Phase2Input } from './phase-2-players'
import { runPhase3Baseline, runPhase4History } from './phase-3-4'
import { classifySituation, createEntityId } from './helpers'

interface OrchestratorDependencies {
  getCanonical: () => CanonicalStore
  getAnalysisFile: () => CurrentAnalysisFile | null
  getPersistedRevision: () => number
  getActiveAnalysisId: () => string
  dispatch: (command: Command) => DispatchResult
  emitConversationMessage: (message: Omit<ConversationMessage, 'id' | 'timestamp'>) => void
}

const PHASE_NAMES: Record<number, string> = {
  1: 'Situational Grounding',
  2: 'Player Identification',
  3: 'Baseline Strategic Model',
  4: 'Historical Repeated Game',
  5: 'Recursive Revalidation',
  6: 'Full Formalization',
  7: 'Assumption Extraction',
  8: 'Elimination',
  9: 'Scenario Generation',
  10: 'Meta-check',
}

function createPhaseExecution(phase: number): PhaseExecution {
  return {
    id: createEntityId('phase_execution'),
    phase,
    pass_number: getPipelineState().analysis_state?.pass_number ?? 1,
    provider_id: 'browser-fallback',
    model_id: 'heuristic-m5',
    prompt_version_id: `m5-phase-${phase}`,
    started_at: new Date().toISOString(),
    completed_at: null,
    duration_ms: null,
    input_tokens: 0,
    output_tokens: 0,
    cost_usd: null,
    status: 'running',
    error: null,
  }
}

function setPhaseRunning(phase: number, executionId: string): void {
  const now = new Date().toISOString()
  updateAnalysisState((analysisState) => {
    if (!analysisState) {
      return analysisState
    }

    return {
      ...analysisState,
      current_phase: phase,
      status: 'running',
      phase_states: {
        ...analysisState.phase_states,
        [phase]: {
          ...analysisState.phase_states[phase],
          status: 'running',
          started_at: now,
          phase_execution_id: executionId,
        },
      },
    }
  })
}

function setPhaseFinished(phase: number, executionId: string, status: 'complete' | 'needs_rerun', paused = true): void {
  const now = new Date().toISOString()
  updateAnalysisState((analysisState) => {
    if (!analysisState) {
      return analysisState
    }

    return {
      ...analysisState,
      current_phase: null,
      status: paused ? 'paused' : 'running',
      phase_states: {
        ...analysisState.phase_states,
        [phase]: {
          ...analysisState.phase_states[phase],
          status,
          completed_at: now,
          phase_execution_id: executionId,
        },
      },
    }
  })
}

function getPhaseState(phase: number): AnalysisState {
  const analysisState = getPipelineState().analysis_state
  if (!analysisState) {
    throw new Error('No active analysis state.')
  }
  return analysisState
}

function requirePhasePrerequisite(phase: number): void {
  if (phase === 1) {
    return
  }

  const pipelineAnalysisState = getPipelineState().analysis_state
  if (!pipelineAnalysisState) {
    throw new Error(`Phase ${phase - 1} (${PHASE_NAMES[phase - 1]}) must be completed first.`)
  }

  const analysisState = getPhaseState(phase)
  const priorState = analysisState.phase_states[phase - 1]
  if (!priorState || priorState.status !== 'complete') {
    throw new Error(`Phase ${phase - 1} (${PHASE_NAMES[phase - 1]}) must be completed first.`)
  }
}

export function createPipelineOrchestrator(deps: OrchestratorDependencies): PipelineOrchestrator {
  return {
    async startAnalysis(description, options) {
      const classification = classifySituation(description)
      const analysisState = startPipelineAnalysis({
        analysisId: deps.getActiveAnalysisId(),
        description,
        domain: classification.domain,
        classification,
      })

      deps.emitConversationMessage({
        role: 'ai',
        content: options?.manual
          ? 'Manual mode is active. Use the phase screens to build the model without an MCP client.'
          : `Starting analysis of: ${description}`,
        message_type: 'phase_transition',
        phase: 1,
      })

      return analysisState
    },

    async runPhase(phase) {
      requirePhasePrerequisite(phase)

      const analysisState = getPipelineState().analysis_state
      if (!analysisState) {
        throw new Error('No active analysis. Start an analysis before running phases.')
      }

      const phaseExecution = createPhaseExecution(phase)
      upsertPhaseExecution(phaseExecution)
      setPhaseRunning(phase, phaseExecution.id)
      deps.emitConversationMessage({
        role: 'ai',
        content: `Starting Phase ${phase}: ${PHASE_NAMES[phase]}...`,
        message_type: 'phase_transition',
        phase,
      })

      const baseRevision = deps.getPersistedRevision()
      const canonical = deps.getCanonical()
      let result: PhaseResult
      let proposals: EvidenceProposal[] = []

      if (phase === 1) {
        const output = runPhase1Grounding(
          {
            situation_description: analysisState.event_description,
          } satisfies Phase1Input,
          { canonical, baseRevision, phaseExecution },
        )
        result = output.result.status
        proposals = output.result.proposals
        setPhaseResult(1, output.result)
        updateAnalysisState((state) => state ? { ...state, classification: output.classification } : state)
      } else if (phase === 2) {
        const output = runPhase2Players(
          {} satisfies Phase2Input,
          { canonical, analysisState, baseRevision, phaseExecution },
        )
        result = output.status
        proposals = output.proposals
        setPhaseResult(2, output)
      } else if (phase === 3) {
        const output = runPhase3Baseline({ canonical, analysisState, baseRevision, phaseExecution })
        result = output.status
        proposals = output.proposals
        setPhaseResult(3, output)
      } else if (phase === 4) {
        const output = runPhase4History({ canonical, analysisState, baseRevision, phaseExecution })
        result = output.status
        proposals = output.proposals
        setPhaseResult(4, output)
      } else {
        result = {
          status: 'failed',
          phase,
          execution_id: phaseExecution.id,
          retriable: true,
          error: `Phase ${phase} is not implemented in M5.`,
        }
      }

      const completedExecution: PhaseExecution = {
        ...phaseExecution,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - new Date(phaseExecution.started_at).getTime(),
        status: result.status === 'failed' ? 'failed' : 'complete',
        error: result.error ?? null,
      }
      upsertPhaseExecution(completedExecution)

      if (proposals.length > 0) {
        registerProposalGroup({
          phase,
          content: `Phase ${phase} complete. Review ${proposals.length} proposal${proposals.length === 1 ? '' : 's'} before continuing.`,
          proposals,
        })
        setPipelineProposalReview(getConversationState().proposal_review)
      } else {
        deps.emitConversationMessage({
          role: 'ai',
          content: `Phase ${phase} complete with no proposals.`,
          message_type: 'result',
          phase,
        })
      }

      setPhaseFinished(phase, phaseExecution.id, result.status === 'failed' ? 'needs_rerun' : 'complete', proposals.length > 0)

      return result
    },

    pause() {
      updateAnalysisState((analysisState) => analysisState ? { ...analysisState, status: 'paused' } : analysisState)
    },

    resume() {
      updateAnalysisState((analysisState) => analysisState ? { ...analysisState, status: 'running' } : analysisState)
    },

    cancelCurrentPhase() {
      updateAnalysisState((analysisState) => analysisState ? { ...analysisState, current_phase: null, status: 'paused' } : analysisState)
    },

    getState() {
      return getPipelineState().analysis_state
    },

    async handleSteering(message) {
      addSteeringMessage(message)
      deps.emitConversationMessage({
        role: 'ai',
        content: `Steering noted: ${message}`,
        message_type: 'steering_ack',
        phase: getPipelineState().analysis_state?.current_phase ?? undefined,
      })
    },
  }
}
