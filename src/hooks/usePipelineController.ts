import { useMemo } from 'react'

import { createPipelineOrchestrator } from '../pipeline'
import { appendConversationMessage } from '../store/conversation'
import {
  getFirstPendingProposalPhase,
  getPipelineState,
  useAppStore,
  useAppStoreApi,
  useMcpConnectionStatus,
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

function findNextPhaseDecision(): NextPhaseDecision {
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
  const connectionStatus = useMcpConnectionStatus()
  const analysisState = usePipelineStore((state) => state.analysis_state)

  const orchestrator = useMemo(() => createPipelineOrchestrator({
    getCanonical: () => appStore.getState().canonical,
    getAnalysisFile: () => {
      const meta = appStore.getState().fileMeta.meta
      return meta ? storeToAnalysisFile(appStore.getState().canonical, meta) : null
    },
    getPersistedRevision: () => appStore.getState().eventLog.persisted_revision,
    getActiveAnalysisId: () => appStore.getState().eventLog.analysis_id,
    dispatch: (command) => appStore.getState().dispatch(command),
    emitConversationMessage: (message) => {
      appendConversationMessage(message)
    },
  }), [appStore])

  async function startAnalysis(description: string, options?: { manual?: boolean }) {
    setManualMode(Boolean(options?.manual))
    const state = await orchestrator.startAnalysis(description, options)
    if (!options?.manual && connectionStatus.connected) {
      await orchestrator.runPhase(1)
    }
    return state
  }

  async function runPhase(phase: number) {
    return orchestrator.runPhase(phase)
  }

  async function runNextPhase() {
    const decision = findNextPhaseDecision()
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

  return {
    analysisState,
    connectionStatus,
    nextPhaseDecision: findNextPhaseDecision(),
    startAnalysis,
    runPhase,
    runNextPhase,
    handleSteering,
  }
}
