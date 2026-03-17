/**
 * Proposal card for propose_revision tool call results.
 * Renders a highlighted card with Accept / Reject actions.
 * Stateful: pending → accepted | rejected.
 */

import { useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { analysisStore } from "@/stores/analysis-store";
import type { AgentToolCallEntry } from "@/stores/ai-store";

export interface ProposalData {
  proposal_id: string;
  entity_type: string;
  entity_id: string;
  changes: Record<string, unknown>;
  rationale: string;
  status: string;
}

interface AgentProposalCardProps {
  toolCall: AgentToolCallEntry;
  onAccept: (proposalData: ProposalData) => void;
  onReject: (proposalData: ProposalData, reason: string) => void;
}

type CardState = "pending" | "accepted" | "rejected";

function extractProposalData(
  toolCall: AgentToolCallEntry,
): ProposalData | null {
  const result = toolCall.result as Record<string, unknown> | null | undefined;
  if (!result || result.success !== true) return null;

  const data = result.data as Record<string, unknown> | undefined;
  if (!data) return null;

  const { proposal_id, entity_type, entity_id, changes, rationale, status } =
    data;

  if (
    typeof proposal_id !== "string" ||
    typeof entity_type !== "string" ||
    typeof entity_id !== "string" ||
    typeof rationale !== "string" ||
    typeof status !== "string" ||
    changes === null ||
    typeof changes !== "object" ||
    Array.isArray(changes)
  ) {
    return null;
  }

  return {
    proposal_id,
    entity_type,
    entity_id,
    changes: changes as Record<string, unknown>,
    rationale,
    status,
  };
}

function ChangesView({ changes }: { changes: Record<string, unknown> }) {
  const entries = Object.entries(changes);
  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No changes specified.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {entries.map(([field, value]) => (
        <div key={field} className="flex items-start gap-2 text-xs">
          <span className="shrink-0 font-mono text-muted-foreground">
            {field}:
          </span>
          <span className="font-mono text-foreground break-all">
            {typeof value === "string" ? value : JSON.stringify(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AgentProposalCard({
  toolCall,
  onAccept,
  onReject,
}: AgentProposalCardProps) {
  const [cardState, setCardState] = useState<CardState>("pending");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const proposalOrNull = extractProposalData(toolCall);

  // Fallback: render as a regular tool call summary if data is malformed
  if (!proposalOrNull) {
    return (
      <div className="rounded-md border border-border bg-background/60 px-2.5 py-2 text-xs text-muted-foreground">
        <span className="font-mono">propose_revision</span>
        {" — "}
        <span className="italic">could not parse proposal data</span>
      </div>
    );
  }

  // Narrow to non-null for use in closures below
  const proposal: ProposalData = proposalOrNull;
  const isResolved = cardState !== "pending";

  function handleAccept() {
    if (isResolved || proposal.status !== "pending") return;

    // Replay _commands from the tool result if present
    const result = toolCall.result as
      | Record<string, unknown>
      | null
      | undefined;
    if (result && Array.isArray(result._commands)) {
      for (const command of result._commands) {
        try {
          analysisStore.getState().dispatch(command);
        } catch {
          // Non-fatal — accept still registers in the UI
        }
      }
    }

    setCardState("accepted");
    onAccept(proposal);
  }

  function handleRejectSubmit() {
    if (isResolved || proposal.status !== "pending") return;
    setCardState("rejected");
    setShowRejectInput(false);
    onReject(proposal, rejectionReason.trim());
  }

  return (
    <div
      className={cn(
        "rounded-md border-2 bg-background text-xs",
        cardState === "pending" &&
          "border-amber-400/70 dark:border-amber-500/60",
        cardState === "accepted" && "border-green-500/70",
        cardState === "rejected" && "border-red-500/70",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-t-sm",
          cardState === "pending" && "bg-amber-50/60 dark:bg-amber-900/20",
          cardState === "accepted" && "bg-green-50/60 dark:bg-green-900/20",
          cardState === "rejected" && "bg-red-50/60 dark:bg-red-900/20",
        )}
      >
        <span
          className={cn(
            "font-semibold",
            cardState === "pending" && "text-amber-700 dark:text-amber-400",
            cardState === "accepted" && "text-green-700 dark:text-green-400",
            cardState === "rejected" && "text-red-700 dark:text-red-400",
          )}
        >
          {cardState === "pending" && "Proposed revision"}
          {cardState === "accepted" && "Accepted"}
          {cardState === "rejected" && "Rejected"}
        </span>

        <span className="text-muted-foreground">·</span>
        <span className="font-mono text-muted-foreground">
          {proposal.entity_type}
        </span>
        <span className="font-mono text-muted-foreground truncate max-w-[120px]">
          {proposal.entity_id}
        </span>

        {cardState === "accepted" && (
          <CheckCircle className="ml-auto h-3.5 w-3.5 text-green-500 shrink-0" />
        )}
        {cardState === "rejected" && (
          <XCircle className="ml-auto h-3.5 w-3.5 text-red-500 shrink-0" />
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 space-y-2.5">
        {/* Rationale */}
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Rationale
          </p>
          <p className="text-foreground leading-snug">{proposal.rationale}</p>
        </div>

        {/* Changes */}
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Changes
          </p>
          <div className="rounded bg-muted px-2 py-1.5">
            <ChangesView changes={proposal.changes} />
          </div>
        </div>

        {/* Action buttons — only shown while pending */}
        {cardState === "pending" && (
          <div className="space-y-2 pt-0.5">
            {!showRejectInput ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAccept}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors",
                    "bg-green-600 text-white hover:bg-green-700",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500",
                  )}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Accept
                </button>

                <button
                  type="button"
                  onClick={() => setShowRejectInput(true)}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors",
                    "bg-red-600 text-white hover:bg-red-700",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
                  )}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Reason for rejection (optional)"
                  aria-label="Rejection reason"
                  className={cn(
                    "w-full rounded border border-border bg-background px-2 py-1 text-xs",
                    "text-foreground placeholder:text-muted-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRejectSubmit();
                    if (e.key === "Escape") setShowRejectInput(false);
                  }}
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleRejectSubmit}
                    className={cn(
                      "flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors",
                      "bg-red-600 text-white hover:bg-red-700",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
                    )}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Confirm rejection
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRejectInput(false)}
                    className={cn(
                      "rounded px-3 py-1 text-xs font-medium transition-colors",
                      "text-muted-foreground hover:text-foreground hover:bg-accent",
                    )}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
