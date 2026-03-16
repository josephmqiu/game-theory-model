import { useEffect, useMemo } from 'react'

import { createPipelineOrchestrator } from '../pipeline'
import { appendConversationMessage } from '../store/conversation'
import {
  getFirstPendingProposalPhase,
  getPipelineState,
  getPipelineRuntimeState,
  type PhaseRunInput,
  useAppStore,
  useAppStoreApi,
  useMcpConnectionStatus,
  usePipelineRuntimeStore,
  usePipelineStore,
} from '../store'
import { storeToAnalysisFile } from '../utils/serialization'

export interface NextPhaseDecision {
  canRun: boolean
  nextPhase: number | null
  reason: 'ready' | 'no_analysis' | 'review_needed' | 'complete'
  blockingPhase: number | null
  message: string
}

function findNextPhaseDecision(params: {
  pendingRevalidationCount: number
}): NextPhaseDecision {
  const analysisState = getPipelineState().analysis_state
  if (!analysisState) {
    return {
      canRun: false,
      nextPhase: null,
      reason: 'no_analysis',
      blockingPhase: null,
      message: 'Start an analysis before running phases.',
    }
  }

  const blockingPhase = getFirstPendingProposalPhase()
  if (blockingPhase != null) {
    return {
      canRun: false,
      nextPhase: null,
      reason: 'review_needed',
      blockingPhase,
      message: `Review Phase ${blockingPhase} proposals before continuing.`,
    }
  }

  const activeRerun = getPipelineRuntimeState().active_rerun_cycle
  if (activeRerun) {
    const remainingTargets = activeRerun.target_phases.filter(
      (phase) => analysisState.phase_states[phase]?.status !== 'complete',
    )
    if (remainingTargets.length === 0) {
      return {
        canRun: false,
        nextPhase: null,
        reason: 'review_needed',
        blockingPhase: 5,
        message: `Revalidation pass ${activeRerun.pass_number} is finalizing in Phase 5.`,
      }
    }

    const nextPhase = Math.min(...remainingTargets)
    return {
      canRun: true,
      nextPhase,
      reason: 'ready',
      blockingPhase: null,
      message: `Revalidation pass ${activeRerun.pass_number} is queued from Phase ${nextPhase}.`,
    }
  }

  if (params.pendingRevalidationCount > 0) {
    return {
      canRun: false,
      nextPhase: null,
      reason: 'review_needed',
      blockingPhase: 5,
      message: `Resolve ${params.pendingRevalidationCount} pending revalidation event(s) in Phase 5 before continuing.`,
    }
  }

  for (let phase = 1; phase <= 10; phase += 1) {
    const phaseState = analysisState.phase_states[phase]
    if (!phaseState || phaseState.status === 'pending' || phaseState.status === 'needs_rerun') {
      return {
        canRun: true,
        nextPhase: phase,
        reason: 'ready',
        blockingPhase: null,
        message: `Phase ${phase} is ready to run.`,
      }
    }
  }

  return {
    canRun: false,
    nextPhase: null,
    reason: 'complete',
    blockingPhase: null,
    message: 'All currently implemented phases are complete.',
  }
}

export function usePipelineController() {
  const appStore = useAppStoreApi()
  const setManualMode = useAppStore((state) => state.setManualMode)
  const pendingRevalidationCount = useAppStore((state) =>
    Object.values(state.canonical.revalidation_events).filter((event) => event.resolution === 'pending').length,
  )
  const connectionStatus = useMcpConnectionStatus()
  const analysisState = usePipelineStore((state) => state.analysis_state)
  const promptRegistry = usePipelineRuntimeStore((state) => state.prompt_registry)
  const activeRerunCycle = usePipelineRuntimeStore((state) => state.active_rerun_cycle)

  const orchestrator = useMemo(() => createPipelineOrchestrator({
    getCanonical: () => appStore.getState().canonical,
    getAnalysisFile: () => {
      const meta = appStore.getState().fileMeta.meta
      return meta ? storeToAnalysisFile(appStore.getState().canonical, meta) : null
    },
    getPersistedRevision: () => appStore.getState().eventLog.persisted_revision,
    getActiveAnalysisId: () => appStore.getState().eventLog.analysis_id,
    resetAnalysisSession: () => appStore.getState().resetAnalysisSession(),
    dispatch: (command, opts) => appStore.getState().dispatch(command, opts),
    emitConversationMessage: (message) => {
      appendConversationMessage(message)
    },
  }), [appStore])

  useEffect(() => {
    if (!activeRerunCycle || !analysisState) {
      return
    }
    orchestrator.reconcileActiveRerunCycle()
  }, [activeRerunCycle, analysisState?.phase_states, orchestrator])

  async function startAnalysis(description: string, options?: { manual?: boolean }) {
    setManualMode(Boolean(options?.manual))
    const state = await orchestrator.startAnalysis(description, options)
    if (!options?.manual && connectionStatus.connected) {
      await orchestrator.runPhase(1)
    }
    return state
  }

  async function runPhase(phase: number, input?: PhaseRunInput) {
    return orchestrator.runPhase(phase, input)
  }

  async function runNextPhase() {
    const decision = findNextPhaseDecision({ pendingRevalidationCount })
    if (!decision.canRun || decision.nextPhase == null) {
      return decision
    }
    const result = await orchestrator.runPhase(decision.nextPhase)
    return {
      ...decision,
      result,
    }
  }

  async function handleSteering(message: string) {
    return orchestrator.handleSteering(message)
  }

  async function approveRevalidation(eventId: string) {
    return orchestrator.approveRevalidation(eventId)
  }

  function dismissRevalidation(eventId: string) {
    orchestrator.dismissRevalidation(eventId)
  }

  function forkPromptVersion(
    phase: number,
    params?: { name?: string; content?: string; description?: string },
  ) {
    return orchestrator.forkPromptVersion(phase, params)
  }

  return {
    analysisState,
    promptRegistry,
    activeRerunCycle,
    connectionStatus,
    nextPhaseDecision: findNextPhaseDecision({ pendingRevalidationCount }),
    startAnalysis,
    runPhase,
    runNextPhase,
    handleSteering,
    approveRevalidation,
    dismissRevalidation,
    forkPromptVersion,
  }
}
