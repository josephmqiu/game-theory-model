import { useCallback } from 'react'

import { appendConversationMessage, clearConversation as clearConversationState, getEvidenceProposal, updateProposalStatus, useAppStore, useConversationStore } from '../store'
import { usePipelineController } from './usePipelineController'

export function useConversation() {
  const messages = useConversationStore((state) => state.messages)
  const dispatch = useAppStore((state) => state.dispatch)
  const persistedRevision = useAppStore((state) => state.eventLog.persisted_revision)
  const manualMode = useAppStore((state) => state.viewState.manualMode)
  const {
    analysisState,
    connectionStatus,
    handleSteering,
    nextPhaseDecision,
    startAnalysis,
    runNextPhase: runNextPhaseInternal,
    runPhase,
  } = usePipelineController()

  const sendMessage = useCallback((content: string) => {
    const trimmed = content.trim()
    if (!trimmed) {
      return
    }

    appendConversationMessage({
      role: 'user',
      content: trimmed,
    })

    if (manualMode) {
      return
    }

    if (!analysisState) {
      void startAnalysis(trimmed, { manual: false })
      return
    }

    void handleSteering(trimmed)
  }, [analysisState, handleSteering, manualMode, startAnalysis])

  const acceptProposal = useCallback((proposalId: string) => {
    const proposal = getEvidenceProposal(proposalId)
    if (!proposal) {
      return {
        status: 'rejected' as const,
        reason: 'error' as const,
        errors: ['Proposal not found.'],
      }
    }

    const result = dispatch({
      kind: 'batch',
      label: proposal.description,
      base_revision: persistedRevision,
      commands: proposal.commands,
    })

    if (result.status === 'committed') {
      updateProposalStatus(proposalId, 'accepted', 'accepted')
      appendConversationMessage({
        role: 'ai',
        content: `Accepted proposal: ${proposal.description}`,
        message_type: 'result',
        phase: proposal.phase,
      })
      return result
    }

    updateProposalStatus(proposalId, 'conflict', 'modified')
    appendConversationMessage({
      role: 'ai',
      content: `Could not accept proposal: ${proposal.description}. ${
        result.status === 'rejected' ? result.errors.join(' ') : 'The proposal was not committed.'
      }`,
      message_type: 'proposal',
      phase: proposal.phase,
    })
    return result
  }, [dispatch, persistedRevision])

  const rejectProposal = useCallback((proposalId: string) => {
    updateProposalStatus(proposalId, 'rejected', 'rejected')
  }, [])

  const modifyProposal = useCallback((proposalId: string) => {
    updateProposalStatus(proposalId, 'partially_accepted', 'modified')
    appendConversationMessage({
      role: 'ai',
      content: `Proposal ${proposalId} marked for manual adjustment. Review the preview and refine it in the relevant modeling screen or inspector.`,
      message_type: 'proposal',
    })
  }, [])

  const runNextPhase = useCallback(async () => {
    try {
      const result = await runNextPhaseInternal()
      if (result && 'canRun' in result && !result.canRun) {
        appendConversationMessage({
          role: 'ai',
          content: result.message,
          message_type: 'result',
          phase: result.blockingPhase ?? undefined,
        })
      }
      return result
    } catch (error) {
      appendConversationMessage({
        role: 'ai',
        content: error instanceof Error ? error.message : 'Could not run the next phase.',
        message_type: 'result',
      })
      return null
    }
  }, [runNextPhaseInternal])

  return {
    messages,
    connectionStatus,
    sendMessage,
    clearConversation: clearConversationState,
    acceptProposal,
    rejectProposal,
    modifyProposal,
    nextPhaseDecision,
    runNextPhase,
    runPhase,
  }
}
