// Test-compatible in-memory stub for conversation state used by pipeline tests.
// Production code uses src/stores/conversation-store.ts (Zustand) instead.

import type {
  ConversationMessage,
  DiffReviewState,
  ProposalGroup,
} from "../types/conversation.ts";
import type { EvidenceProposal } from "../types/analysis-pipeline.ts";

interface ConversationState {
  activeAnalysisId: string | null;
  messages: ConversationMessage[];
  proposal_review: DiffReviewState;
  proposals_by_id: Record<string, EvidenceProposal>;
}

function createEmptyDiffReviewState(): DiffReviewState {
  return {
    proposals: [],
    active_proposal_index: 0,
    merge_log: [],
  };
}

function createInitialState(): ConversationState {
  return {
    activeAnalysisId: null,
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

let state: ConversationState = createInitialState();

export function getConversationState(): ConversationState {
  return state;
}

export function resetConversationStore(): void {
  state = createInitialState();
}

export function appendConversationMessage(
  message: Omit<ConversationMessage, "id" | "timestamp"> &
    Partial<Pick<ConversationMessage, "id" | "timestamp">>,
): ConversationMessage {
  const nextMessage: ConversationMessage = {
    ...message,
    id: message.id ?? `message_${crypto.randomUUID()}`,
    timestamp: message.timestamp ?? new Date().toISOString(),
  };

  state = {
    ...state,
    messages: [...state.messages, nextMessage],
  };

  return nextMessage;
}

export function clearConversation(): void {
  state = {
    ...state,
    messages: [],
    proposal_review: createEmptyDiffReviewState(),
    proposals_by_id: {},
  };
}

export function registerProposalGroup(params: {
  phase: number;
  content: string;
  message_type?: ConversationMessage["message_type"];
  proposals: EvidenceProposal[];
}): ProposalGroup {
  const groupId = `proposal_group_${crypto.randomUUID()}`;
  const proposals = params.proposals.map((proposal) => ({
    id: proposal.id,
    description: proposal.description,
    entity_previews: proposal.entity_previews,
    status:
      proposal.status === "partially_accepted" || proposal.status === "conflict"
        ? ("modified" as const)
        : proposal.status,
  }));

  const proposalGroup: ProposalGroup = {
    id: groupId,
    phase: params.phase,
    proposals,
    status: computeGroupStatus(proposals),
  };

  const proposals_by_id = { ...state.proposals_by_id };
  for (const proposal of params.proposals) {
    proposals_by_id[proposal.id] = proposal;
  }

  const nextMessage: ConversationMessage = {
    id: `message_${crypto.randomUUID()}`,
    role: "ai",
    timestamp: new Date().toISOString(),
    content: params.content,
    phase: params.phase,
    message_type: params.message_type ?? "proposal",
    structured_content: {
      proposals: [proposalGroup],
    },
  };

  state = {
    ...state,
    messages: [...state.messages, nextMessage],
    proposals_by_id,
    proposal_review: {
      proposals: [
        ...state.proposal_review.proposals,
        ...params.proposals.map((p) => p.id),
      ],
      active_proposal_index: state.proposal_review.proposals.length,
      merge_log: state.proposal_review.merge_log,
    },
  };

  return proposalGroup;
}

export function getEvidenceProposal(
  proposalId: string,
): EvidenceProposal | null {
  return state.proposals_by_id[proposalId] ?? null;
}

export function updateRevalidationActionStatus(
  eventId: string,
  resolution: "pending" | "approved" | "rerun_complete" | "dismissed",
): void {
  state = {
    ...state,
    messages: state.messages.map((message) => {
      if (!message.structured_content?.revalidation_actions?.length) {
        return message;
      }
      return {
        ...message,
        structured_content: {
          ...message.structured_content,
          revalidation_actions:
            message.structured_content.revalidation_actions.map((event) =>
              event.event_id === eventId ? { ...event, resolution } : event,
            ),
        },
      };
    }),
  };
}

export function getProposalGroups(): ProposalGroup[] {
  return state.messages.flatMap(
    (message) => message.structured_content?.proposals ?? [],
  );
}

export function getFirstPendingProposalPhase(maxPhase?: number): number | null {
  const pendingPhases = getProposalGroups()
    .filter((group) =>
      group.proposals.some((proposal) => proposal.status === "pending"),
    )
    .map((group) => group.phase)
    .filter((phase) => maxPhase == null || phase < maxPhase)
    .sort((left, right) => left - right);

  return pendingPhases[0] ?? null;
}

export function hasPendingProposalGroupsForPhase(phase: number): boolean {
  return getProposalGroups().some(
    (group) =>
      group.phase === phase &&
      group.proposals.some((proposal) => proposal.status === "pending"),
  );
}
