import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'

import type {
  ActiveRerunCycle,
  PendingRevalidationApproval,
  PipelineRuntimeSnapshot,
  PromptRegistry,
} from '../types/analysis-pipeline'
import { createBrowserPersistenceAdapter } from './persistence'
import { createDefaultPromptRegistry } from '../pipeline/prompt-registry'

interface PipelineRuntimeState extends PipelineRuntimeSnapshot {
  activeAnalysisId: string | null
}

const persistence = createBrowserPersistenceAdapter<PipelineRuntimeSnapshot>('m6:pipeline-runtime')

function createInitialState(): PipelineRuntimeState {
  return {
    activeAnalysisId: null,
    prompt_registry: createDefaultPromptRegistry(),
    pending_revalidation_approvals: {},
    active_rerun_cycle: null,
  }
}

function persistCurrentState(state: PipelineRuntimeState): void {
  persistence.save(state.activeAnalysisId, {
    prompt_registry: state.prompt_registry,
    pending_revalidation_approvals: state.pending_revalidation_approvals,
    active_rerun_cycle: state.active_rerun_cycle,
  })
}

function loadSnapshot(analysisId: string | null): PipelineRuntimeState {
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
    prompt_registry: snapshot.prompt_registry ?? createDefaultPromptRegistry(),
    pending_revalidation_approvals: snapshot.pending_revalidation_approvals ?? {},
    active_rerun_cycle: snapshot.active_rerun_cycle ?? null,
  }
}

const pipelineRuntimeStore = createStore<PipelineRuntimeState>(() => createInitialState())

export function setPipelineRuntimeActiveAnalysis(analysisId: string | null): void {
  pipelineRuntimeStore.setState(loadSnapshot(analysisId))
}

export function resetPipelineRuntimeStore(): void {
  pipelineRuntimeStore.setState(createInitialState())
}

export function usePipelineRuntimeStore<T>(selector: (state: PipelineRuntimeState) => T): T {
  return useStore(pipelineRuntimeStore, selector)
}

export function getPipelineRuntimeState(): PipelineRuntimeState {
  return pipelineRuntimeStore.getState()
}

export function updatePromptRegistry(
  updater: (registry: PromptRegistry) => PromptRegistry,
): void {
  pipelineRuntimeStore.setState((state) => {
    const nextState = {
      ...state,
      prompt_registry: updater(state.prompt_registry),
    }
    persistCurrentState(nextState)
    return nextState
  })
}

export function registerPendingRevalidationApproval(
  pendingApproval: PendingRevalidationApproval,
): void {
  pipelineRuntimeStore.setState((state) => {
    const nextState = {
      ...state,
      pending_revalidation_approvals: {
        ...state.pending_revalidation_approvals,
        [pendingApproval.event_id]: pendingApproval,
      },
    }
    persistCurrentState(nextState)
    return nextState
  })
}

export function clearPendingRevalidationApproval(eventId: string): void {
  pipelineRuntimeStore.setState((state) => {
    if (!(eventId in state.pending_revalidation_approvals)) {
      return state
    }

    const { [eventId]: _removed, ...remaining } = state.pending_revalidation_approvals
    const nextState = {
      ...state,
      pending_revalidation_approvals: remaining,
    }
    persistCurrentState(nextState)
    return nextState
  })
}

export function setActiveRerunCycle(cycle: ActiveRerunCycle | null): void {
  pipelineRuntimeStore.setState((state) => {
    const nextState = {
      ...state,
      active_rerun_cycle: cycle,
    }
    persistCurrentState(nextState)
    return nextState
  })
}
