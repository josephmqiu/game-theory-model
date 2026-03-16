import type { ReactNode } from 'react'

import { useConversation } from '../../../hooks/useConversation'
import { useKeyFindings } from '../../../hooks/useKeyFindings'
import { usePhaseProgress } from '../../../hooks/usePhaseProgress'
import { useAppStore } from '../../../store'
import {
  ConversationArea,
  ConversationInput,
  KeyFindingsDashboard,
  PhaseProgressBar,
} from '../../overview'

export function OverviewScreen(): ReactNode {
  const manualMode = useAppStore((state) => state.viewState.manualMode)
  const {
    activeRerunCycle,
    messages,
    connectionStatus,
    sendMessage,
    acceptProposal,
    rejectProposal,
    modifyProposal,
    approveRevalidation,
    dismissRevalidation,
    nextPhaseDecision,
    runNextPhase,
  } = useConversation()
  const phaseProgress = usePhaseProgress()
  const findings = useKeyFindings()

  const guidance = manualMode
    ? 'Manual mode is active. Use the phase screens to create and edit the model directly.'
    : connectionStatus.connected
      ? null
      : 'No MCP client is connected. You can still inspect proposals and work manually, or connect a client from Settings.'

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary">Overview</h1>
          <p className="mt-1 text-sm text-text-muted">
            Conversation-first command center for M5 phases 1-4, with explicit review before canonical promotion.
          </p>
        </div>
        {!manualMode ? (
          <button
            type="button"
            className="rounded-lg border border-border bg-bg-card px-4 py-2 text-sm text-text-primary hover:border-accent"
            onClick={() => void runNextPhase()}
            disabled={!nextPhaseDecision.canRun}
            title={nextPhaseDecision.message}
          >
            {nextPhaseDecision.canRun && nextPhaseDecision.nextPhase
              ? `Run Phase ${nextPhaseDecision.nextPhase}`
              : 'Run Next Phase'}
          </button>
        ) : null}
      </div>
      {!manualMode && !nextPhaseDecision.canRun ? (
        <p className="text-sm text-text-muted">{nextPhaseDecision.message}</p>
      ) : null}

      <PhaseProgressBar {...phaseProgress} />
      <KeyFindingsDashboard findings={findings} />

      <div className="min-h-0 flex-1">
        {manualMode ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-bg-card p-8 text-center text-sm text-text-muted">
            Manual mode is active. Use the sidebar phase screens and model views to build the analysis without any MCP client.
          </div>
        ) : (
          <ConversationArea
            messages={messages}
            onAcceptProposal={acceptProposal}
            onRejectProposal={rejectProposal}
            onModifyProposal={modifyProposal}
            onApproveRevalidation={approveRevalidation}
            onDismissRevalidation={dismissRevalidation}
          />
        )}
      </div>

      {!manualMode && activeRerunCycle ? (
        <p className="text-xs text-text-muted">
          Revalidation pass {activeRerunCycle.pass_number} is queued from Phase {activeRerunCycle.earliest_phase}.
        </p>
      ) : null}

      {!manualMode ? (
        <ConversationInput
          onSend={sendMessage}
          disabled={!connectionStatus.connected}
          guidance={guidance}
        />
      ) : null}
    </div>
  )
}
