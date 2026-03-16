/**
 * Conversation store — chat messages + proposal tracking.
 */

import { createStore, useStore } from "zustand";
import type {
  ConversationMessage,
  DiffReviewState,
  RevalidationActionCard,
} from "shared/game-theory/types/conversation";
import type { EvidenceProposal } from "shared/game-theory/types/analysis-pipeline";

export interface ConversationState {
  messages: ConversationMessage[];
  proposal_review: DiffReviewState | null;
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
    proposals: EvidenceProposal[];
  }) => void;
  getFirstPendingProposalPhase: (maxPhase?: number) => number | null;
  updateRevalidationActionStatus: (
    eventId: string,
    resolution: RevalidationActionCard["resolution"],
  ) => void;
  resetConversation: () => void;
}

type ConversationStore = ConversationState & ConversationActions;

function createInitialState(): ConversationState {
  return {
    messages: [],
    proposal_review: null,
    proposals_by_id: {},
  };
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
    const proposalsById = { ...state.proposals_by_id };
    for (const proposal of params.proposals) {
      proposalsById[proposal.id] = proposal;
    }
    set({ proposals_by_id: proposalsById });
  },

  getFirstPendingProposalPhase(_maxPhase) {
    // Will be fully implemented when proposal review is wired
    return null;
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
