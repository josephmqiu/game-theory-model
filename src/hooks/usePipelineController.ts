import { useMemo } from 'react'

import { createPipelineOrchestrator } from '../pipeline'
import { appendConversationMessage } from '../store/conversation'
import { getPipelineState, useAppStore, useMcpConnectionStatus, usePipelineStore } from '../store'

function findNextPhase(): number | null {
  const analysisState = getPipelineState().analysis_state
  if (!analysisState) {
    return 1
  }

  for (let phase = 1; phase <= 10; phase += 1) {
    const phaseState = analysisState.phase_states[phase]
    if (!phaseState || phaseState.status === 'pending' || phaseState.status === 'needs_rerun') {
      return phase
    }
  }

  return null
}

export function usePipelineController() {
  const dispatch = useAppStore((state) => state.dispatch)
  const canonical = useAppStore((state) => state.canonical)
  const eventLog = useAppStore((state) => state.eventLog)
  const fileMeta = useAppStore((state) => state.fileMeta)
  const setManualMode = useAppStore((state) => state.setManualMode)
  const connectionStatus = useMcpConnectionStatus()
  const analysisState = usePipelineStore((state) => state.analysis_state)

  const orchestrator = useMemo(() => createPipelineOrchestrator({
    getCanonical: () => canonical,
    getAnalysisFile: () => null,
    getPersistedRevision: () => eventLog.persisted_revision,
    getActiveAnalysisId: () => eventLog.analysis_id,
    dispatch,
    emitConversationMessage: (message) => {
      appendConversationMessage(message)
    },
  }), [canonical, dispatch, eventLog.analysis_id, eventLog.persisted_revision, fileMeta.meta])

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
    const nextPhase = findNextPhase()
    if (!nextPhase) {
      return null
    }
    return orchestrator.runPhase(nextPhase)
  }

  async function handleSteering(message: string) {
    return orchestrator.handleSteering(message)
  }

  return {
    analysisState,
    connectionStatus,
    startAnalysis,
    runPhase,
    runNextPhase,
    handleSteering,
  }
}
