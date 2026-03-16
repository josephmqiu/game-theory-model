/**
 * Proposal review panel — accept/reject proposals using acceptConversationProposal.
 */

import { useState } from "react";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";
import type { ProposalGroup } from "shared/game-theory/types/conversation";
import {
  useConversationStore,
  conversationStore,
} from "@/stores/conversation-store";
import { analysisStore } from "@/stores/analysis-store";
import { acceptConversationProposal } from "@/stores/proposal-actions";

interface ProposalReviewProps {
  phase: number;
}

export function ProposalReview({ phase }: ProposalReviewProps) {
  const proposalGroups = useConversationStore((s) => {
    return s.messages
      .filter((m) => m.phase === phase)
      .flatMap((m) => m.structured_content?.proposals ?? []);
  });

  if (proposalGroups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        Proposals for Review
      </h3>
      {proposalGroups.map((group) => (
        <ProposalGroupCard key={group.id} group={group} />
      ))}
    </div>
  );
}

function ProposalGroupCard({ group }: { group: ProposalGroup }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <StatusBadge status={group.status} />
          <span className="text-sm font-medium">
            {group.proposals.length} proposal
            {group.proposals.length !== 1 ? "s" : ""}
          </span>
        </div>
        {expanded ? (
          <ChevronUp size={14} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={14} className="text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {group.proposals.map((proposal) => (
            <ProposalRow key={proposal.id} proposalId={proposal.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProposalRow({ proposalId }: { proposalId: string }) {
  const [error, setError] = useState<string | null>(null);
  const proposal = useConversationStore((s) => s.proposals_by_id[proposalId]);

  if (!proposal) return null;

  const isPending = proposal.status === "pending";

  function handleAccept() {
    setError(null);
    const canonical = analysisStore.getState().canonical;
    const revision = analysisStore.getState().eventLog.cursor;
    const dispatchFn = analysisStore.getState().dispatch;

    const result = acceptConversationProposal({
      proposalId,
      canonical,
      currentPersistedRevision: revision,
      dispatch: dispatchFn,
    });

    if (result.status === "rejected") {
      setError(result.errors.join(", "));
    }
  }

  function handleReject() {
    conversationStore
      .getState()
      .updateProposalStatus(proposalId, "rejected", "rejected");
  }

  return (
    <div className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm">{proposal.description}</p>
          {proposal.entity_previews.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {proposal.entity_previews.map((preview, i) => (
                <span
                  key={`${preview.entity_type}-${i}`}
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    preview.action === "add"
                      ? "bg-green-500/10 text-green-600"
                      : preview.action === "update"
                        ? "bg-blue-500/10 text-blue-600"
                        : "bg-red-500/10 text-red-600"
                  }`}
                >
                  {preview.action} {preview.entity_type}
                </span>
              ))}
            </div>
          )}
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>

        {isPending && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleAccept}
              className="rounded p-1.5 text-green-500 hover:bg-green-500/10 transition-colors"
              title="Accept"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={handleReject}
              className="rounded p-1.5 text-red-500 hover:bg-red-500/10 transition-colors"
              title="Reject"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {!isPending && (
          <StatusBadge
            status={
              proposal.status === "accepted"
                ? "accepted"
                : proposal.status === "rejected"
                  ? "rejected"
                  : "partially_accepted"
            }
          />
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ProposalGroup["status"] | string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    pending: {
      bg: "bg-yellow-500/10",
      text: "text-yellow-600",
      label: "Pending",
    },
    accepted: {
      bg: "bg-green-500/10",
      text: "text-green-600",
      label: "Accepted",
    },
    rejected: {
      bg: "bg-red-500/10",
      text: "text-red-600",
      label: "Rejected",
    },
    partially_accepted: {
      bg: "bg-orange-500/10",
      text: "text-orange-600",
      label: "Partial",
    },
    conflict: {
      bg: "bg-red-500/10",
      text: "text-red-600",
      label: "Conflict",
    },
  };

  const c = config[status] ?? config.pending;

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
