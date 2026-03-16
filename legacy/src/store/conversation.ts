import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'

import type {
  ConversationMessage,
  DiffReviewState,
  Proposal,
  ProposalGroup,
} from '../types/conversation'
import type { EvidenceProposal } from '../types/analysis-pipeline'
import { createBrowserPersistenceAdapter } from './persistence'
import { setPipelineProposalReview, syncPipelineReviewStatuses } from './pipeline'

interface ConversationSnapshot {
  messages: ConversationMessage[]
  proposal_review: DiffReviewState
  proposals_by_id: Record<string, EvidenceProposal>
}

interface ConversationState extends ConversationSnapshot {
  activeAnalysisId: string | null
}

const persistence = createBrowserPersistenceAdapter<ConversationSnapshot>('m5:conversation')

function createEmptyDiffReviewState(): DiffReviewState {
  return {
    proposals: [],
    active_proposal_index: 0,
    merge_log: [],
  }
}

function createInitialState(): ConversationState {
  return {
    activeAnalysisId: null,
    messages: [],
    proposal_review: createEmptyDiffReviewState(),
    proposals_by_id: {},
  }
}

function persistCurrentState(state: ConversationState): void {
  persistence.save(state.activeAnalysisId, {
    messages: state.messages,
    proposal_review: state.proposal_review,
    proposals_by_id: state.proposals_by_id,
  })
}

function getProposalGroupsFromMessages(messages: ReadonlyArray<ConversationMessage>): ProposalGroup[] {
  return messages.flatMap((message) => message.structured_content?.proposals ?? [])
}

function syncPipelineReviewState(state: ConversationState): void {
  setPipelineProposalReview(state.proposal_review)
  syncPipelineReviewStatuses(getProposalGroupsFromMessages(state.messages))
}

function computeGroupStatus(proposals: ReadonlyArray<Proposal>): ProposalGroup['status'] {
  if (proposals.length === 0 || proposals.every((proposal) => proposal.status === 'pending')) {
    return 'pending'
  }

  if (proposals.every((proposal) => proposal.status === 'accepted')) {
    return 'accepted'
  }

  if (proposals.every((proposal) => proposal.status === 'rejected')) {
    return 'rejected'
  }

  return 'partially_accepted'
}

function loadSnapshot(analysisId: string | null): ConversationState {
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
    messages: snapshot.messages,
    proposal_review: snapshot.proposal_review,
    proposals_by_id: snapshot.proposals_by_id,
  }
}

const conversationStore = createStore<ConversationState>(() => createInitialState())

export function setConversationActiveAnalysis(analysisId: string | null): void {
  const nextState = loadSnapshot(analysisId)
  conversationStore.setState(nextState)
  syncPipelineReviewState(nextState)
}

export function clearConversationPersistence(analysisId: string | null): void {
  persistence.clear(analysisId)
}

export function resetConversationStore(): void {
  const nextState = createInitialState()
  conversationStore.setState(nextState)
  syncPipelineReviewState(nextState)
}

export function useConversationStore<T>(selector: (state: ConversationState) => T): T {
  return useStore(conversationStore, selector)
}

export function getConversationState(): ConversationState {
  return conversationStore.getState()
}

export function appendConversationMessage(
  message: Omit<ConversationMessage, 'id' | 'timestamp'> & Partial<Pick<ConversationMessage, 'id' | 'timestamp'>>,
): ConversationMessage {
  const nextMessage: ConversationMessage = {
    ...message,
    id: message.id ?? `message_${crypto.randomUUID()}`,
    timestamp: message.timestamp ?? new Date().toISOString(),
  }

  conversationStore.setState((state) => {
    const nextState = {
      ...state,
      messages: [...state.messages, nextMessage],
    }
    persistCurrentState(nextState)
    return nextState
  })

  return nextMessage
}

export function clearConversation(): void {
  conversationStore.setState((state) => {
    const nextState = {
      ...state,
      messages: [],
      proposal_review: createEmptyDiffReviewState(),
      proposals_by_id: {},
    }
    persistCurrentState(nextState)
    syncPipelineReviewState(nextState)
    return nextState
  })
}

export function registerProposalGroup(params: {
  phase: number
  content: string
  message_type?: ConversationMessage['message_type']
  proposals: EvidenceProposal[]
}): ProposalGroup {
  const groupId = `proposal_group_${crypto.randomUUID()}`
  const proposals = params.proposals.map((proposal) => ({
    id: proposal.id,
    description: proposal.description,
    entity_previews: proposal.entity_previews,
    status: proposal.status === 'partially_accepted' || proposal.status === 'conflict'
      ? 'modified'
      : proposal.status,
  } satisfies Proposal))
  const proposalGroup: ProposalGroup = {
    id: groupId,
    phase: params.phase,
    proposals,
    status: computeGroupStatus(proposals),
  }

  conversationStore.setState((state) => {
    const proposals_by_id = { ...state.proposals_by_id }
    for (const proposal of params.proposals) {
      proposals_by_id[proposal.id] = proposal
    }

    const nextMessage: ConversationMessage = {
      id: `message_${crypto.randomUUID()}`,
      role: 'ai',
      timestamp: new Date().toISOString(),
      content: params.content,
      phase: params.phase,
      message_type: params.message_type ?? 'proposal',
      structured_content: {
        proposals: [proposalGroup],
      },
    }

    const nextState = {
      ...state,
      messages: [...state.messages, nextMessage],
      proposals_by_id,
      proposal_review: {
        proposals: [...state.proposal_review.proposals, ...params.proposals.map((proposal) => proposal.id)],
        active_proposal_index: state.proposal_review.proposals.length,
        merge_log: state.proposal_review.merge_log,
      },
    }
    persistCurrentState(nextState)
    syncPipelineReviewState(nextState)
    return nextState
  })

  return proposalGroup
}

export function getEvidenceProposal(proposalId: string): EvidenceProposal | null {
  return conversationStore.getState().proposals_by_id[proposalId] ?? null
}

export function updateProposalStatus(
  proposalId: string,
  status: EvidenceProposal['status'],
  mergeAction: 'accepted' | 'rejected' | 'modified',
  options?: {
    conflicts?: EvidenceProposal['conflicts']
  },
): void {
  conversationStore.setState((state) => {
    const existing = state.proposals_by_id[proposalId]
    if (!existing) {
      return state
    }

    const proposalStatus: Proposal['status'] =
      status === 'accepted'
        ? 'accepted'
        : status === 'rejected'
          ? 'rejected'
          : 'modified'

    const messages = state.messages.map((message) => {
      if (!message.structured_content?.proposals) {
        return message
      }

      const groups = message.structured_content.proposals.map((group) => {
        const proposals = group.proposals.map((proposal) =>
          proposal.id === proposalId ? { ...proposal, status: proposalStatus } : proposal,
        )
        return {
          ...group,
          proposals,
          status: computeGroupStatus(proposals),
        }
      })

      return {
        ...message,
        structured_content: {
          ...message.structured_content,
          proposals: groups,
        },
      }
    })

    const nextState = {
      ...state,
      messages,
      proposals_by_id: {
        ...state.proposals_by_id,
        [proposalId]: {
          ...existing,
          status,
          conflicts: status === 'conflict'
            ? options?.conflicts ?? existing.conflicts
            : existing.conflicts,
        },
      },
      proposal_review: {
        ...state.proposal_review,
        merge_log: [
          ...state.proposal_review.merge_log,
          {
            proposal_id: proposalId,
            action: mergeAction,
            timestamp: new Date().toISOString(),
          },
        ],
      },
    }
    persistCurrentState(nextState)
    syncPipelineReviewState(nextState)
    return nextState
  })
}

export function updateRevalidationActionStatus(
  eventId: string,
  resolution: 'pending' | 'approved' | 'rerun_complete' | 'dismissed',
): void {
  conversationStore.setState((state) => {
    const messages = state.messages.map((message) => {
      if (!message.structured_content?.revalidation_actions?.length) {
        return message
      }

      return {
        ...message,
        structured_content: {
          ...message.structured_content,
          revalidation_actions: message.structured_content.revalidation_actions.map((event) =>
            event.event_id === eventId
              ? { ...event, resolution }
              : event,
          ),
        },
      }
    })

    const nextState = {
      ...state,
      messages,
    }
    persistCurrentState(nextState)
    return nextState
  })
}

export function getProposalGroups(): ProposalGroup[] {
  return getProposalGroupsFromMessages(conversationStore.getState().messages)
}

export function getFirstPendingProposalPhase(maxPhase?: number): number | null {
  const pendingPhases = getProposalGroups()
    .filter((group) => group.proposals.some((proposal) => proposal.status === 'pending'))
    .map((group) => group.phase)
    .filter((phase) => maxPhase == null || phase < maxPhase)
    .sort((left, right) => left - right)

  return pendingPhases[0] ?? null
}

export function hasPendingProposalGroupsForPhase(phase: number): boolean {
  return getProposalGroups().some((group) =>
    group.phase === phase && group.proposals.some((proposal) => proposal.status === 'pending'),
  )
}
