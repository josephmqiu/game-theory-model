/**
 * Conversation store — chat messages + proposal tracking.
 */

import { createStore, useStore } from "zustand";
import type {
  ConversationMessage,
  DiffReviewState,
  MergeLogEntry,
  Proposal,
  ProposalGroup,
  RevalidationActionCard,
} from "shared/game-theory/types/conversation";
import type { EvidenceProposal } from "shared/game-theory/types/analysis-pipeline";

export interface ConversationState {
  messages: ConversationMessage[];
  proposal_review: DiffReviewState;
  proposals_by_id: Record<string, EvidenceProposal>;
}

interface ConversationActions {
  appendMessage: (
    message: Omit<ConversationMessage, "id" | "timestamp">,
  ) => void;
  clearConversation: () => void;
  registerProposalGroup: (params: {
    phase: number;
    content: string;
    message_type?: ConversationMessage["message_type"];
    proposals: EvidenceProposal[];
  }) => ProposalGroup;
  getFirstPendingProposalPhase: (maxPhase?: number) => number | null;
  updateProposalStatus: (
    proposalId: string,
    status: EvidenceProposal["status"],
    reviewStatus: Proposal["status"],
    extra?: { conflicts?: EvidenceProposal["conflicts"] },
  ) => void;
  updateRevalidationActionStatus: (
    eventId: string,
    resolution: RevalidationActionCard["resolution"],
  ) => void;
  resetConversation: () => void;
}

type ConversationStore = ConversationState & ConversationActions;

function createEmptyDiffReviewState(): DiffReviewState {
  return {
    proposals: [],
    active_proposal_index: 0,
    merge_log: [],
  };
}

function createInitialState(): ConversationState {
  return {
    messages: [],
    proposal_review: createEmptyDiffReviewState(),
    proposals_by_id: {},
  };
}

function computeGroupStatus(
  proposals: ReadonlyArray<{ status: string }>,
): ProposalGroup["status"] {
  if (
    proposals.length === 0 ||
    proposals.every((p) => p.status === "pending")
  ) {
    return "pending";
  }
  if (proposals.every((p) => p.status === "accepted")) {
    return "accepted";
  }
  if (proposals.every((p) => p.status === "rejected")) {
    return "rejected";
  }
  return "partially_accepted";
}

function mapProposalStatus(
  status: EvidenceProposal["status"],
): Proposal["status"] {
  if (status === "partially_accepted" || status === "conflict") {
    return "modified";
  }
  return status;
}

export const conversationStore = createStore<ConversationStore>((set, get) => ({
  ...createInitialState(),

  appendMessage(message) {
    const fullMessage: ConversationMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    set({ messages: [...get().messages, fullMessage] });
  },

  clearConversation() {
    set(createInitialState());
  },

  registerProposalGroup(params) {
    const state = get();
    const groupId = `proposal_group_${crypto.randomUUID()}`;

    const proposals: Proposal[] = params.proposals.map((proposal) => ({
      id: proposal.id,
      description: proposal.description,
      entity_previews: proposal.entity_previews,
      status: mapProposalStatus(proposal.status),
    }));

    const proposalGroup: ProposalGroup = {
      id: groupId,
      phase: params.phase,
      proposals,
      status: computeGroupStatus(proposals),
    };

    const proposalsById = { ...state.proposals_by_id };
    for (const proposal of params.proposals) {
      proposalsById[proposal.id] = proposal;
    }

    const nextMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      role: "ai",
      timestamp: new Date().toISOString(),
      content: params.content,
      phase: params.phase,
      message_type: params.message_type ?? "proposal",
      structured_content: {
        proposals: [proposalGroup],
      },
    };

    set({
      messages: [...state.messages, nextMessage],
      proposals_by_id: proposalsById,
      proposal_review: {
        proposals: [
          ...state.proposal_review.proposals,
          ...params.proposals.map((p) => p.id),
        ],
        active_proposal_index: state.proposal_review.proposals.length,
        merge_log: state.proposal_review.merge_log,
      },
    });

    return proposalGroup;
  },

  getFirstPendingProposalPhase(maxPhase) {
    const state = get();
    const proposalGroups = state.messages.flatMap(
      (msg) => msg.structured_content?.proposals ?? [],
    );

    const pendingPhases = proposalGroups
      .filter((group) =>
        group.proposals.some((proposal) => proposal.status === "pending"),
      )
      .map((group) => group.phase)
      .filter((phase) => maxPhase == null || phase < maxPhase)
      .sort((left, right) => left - right);

    return pendingPhases[0] ?? null;
  },

  updateProposalStatus(proposalId, status, reviewStatus, extra) {
    const state = get();
    const existing = state.proposals_by_id[proposalId];
    if (!existing) return;

    const updatedProposal: EvidenceProposal = {
      ...existing,
      status,
      conflicts: extra?.conflicts ?? existing.conflicts,
    };

    const mergeAction: MergeLogEntry["action"] =
      reviewStatus === "pending" ? "modified" : reviewStatus;
    const mergeEntry: MergeLogEntry = {
      proposal_id: proposalId,
      action: mergeAction,
      timestamp: new Date().toISOString(),
    };

    const messages = state.messages.map((msg) => {
      if (!msg.structured_content?.proposals) return msg;
      return {
        ...msg,
        structured_content: {
          ...msg.structured_content,
          proposals: msg.structured_content.proposals.map((group) => {
            const hasProposal = group.proposals.some(
              (p) => p.id === proposalId,
            );
            if (!hasProposal) return group;

            const updatedProposals = group.proposals.map((p) =>
              p.id === proposalId ? { ...p, status: reviewStatus } : p,
            );
            return {
              ...group,
              proposals: updatedProposals,
              status: computeGroupStatus(updatedProposals),
            };
          }),
        },
      };
    });

    set({
      proposals_by_id: {
        ...state.proposals_by_id,
        [proposalId]: updatedProposal,
      },
      messages,
      proposal_review: {
        ...state.proposal_review,
        merge_log: [...state.proposal_review.merge_log, mergeEntry],
      },
    });
  },

  updateRevalidationActionStatus(eventId, resolution) {
    const messages = get().messages.map((msg) => {
      if (!msg.structured_content?.revalidation_actions) return msg;
      return {
        ...msg,
        structured_content: {
          ...msg.structured_content,
          revalidation_actions: msg.structured_content.revalidation_actions.map(
            (action) =>
              action.event_id === eventId ? { ...action, resolution } : action,
          ),
        },
      };
    });
    set({ messages });
  },

  resetConversation() {
    set(createInitialState());
  },
}));

export function useConversationStore<T>(
  selector: (state: ConversationStore) => T,
): T {
  return useStore(conversationStore, selector);
}

export function getConversationState(): ConversationState {
  return conversationStore.getState();
}

export function getEvidenceProposal(
  proposalId: string,
): EvidenceProposal | null {
  return conversationStore.getState().proposals_by_id[proposalId] ?? null;
}
