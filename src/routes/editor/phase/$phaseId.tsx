import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { usePipelineStore } from "@/stores/pipeline-store";
import { useConversationStore } from "@/stores/conversation-store";
import { PHASE_NAMES } from "@/constants/phases";
import { executeAppCommand } from "@/services/app-command-runner";
import { ProposalReview } from "@/components/phases/proposal-review";
import { useAnalysisStore } from "@/stores/analysis-store";
import { useUiStore } from "@/stores/ui-store";

export const Route = createFileRoute("/editor/phase/$phaseId")({
  component: PhaseDetailPage,
});

const PHASE_WORKFLOW_COPY: Record<
  string,
  { badge: string; style: string; recommendation: string }
> = {
  pending: {
    badge: "Not started",
    style: "bg-secondary text-muted-foreground",
    recommendation: "Run this phase to generate proposals and phase outputs.",
  },
  running: {
    badge: "Running",
    style: "bg-blue-500/10 text-blue-500",
    recommendation: "Let the phase complete before taking follow-up action.",
  },
  review_needed: {
    badge: "Review needed",
    style: "bg-yellow-500/10 text-yellow-500",
    recommendation:
      "Review proposal outcomes first, then rerun when model changes are accepted.",
  },
  complete: {
    badge: "Complete",
    style: "bg-green-500/10 text-green-500",
    recommendation:
      "Move to the next phase or inspect outputs in related views.",
  },
  needs_rerun: {
    badge: "Needs rerun",
    style: "bg-red-500/10 text-red-500",
    recommendation: "Re-run the phase to clear unresolved blockers.",
  },
  skipped: {
    badge: "Skipped",
    style: "bg-secondary text-muted-foreground",
    recommendation: "No execution required; inspect current analysis evidence.",
  },
};

function PhaseDetailPage() {
  const { phaseId } = Route.useParams();
  const phase = parseInt(phaseId, 10);
  const phaseName = PHASE_NAMES[phase] ?? `Phase ${phase}`;

  const analysisState = usePipelineStore((s) => s.analysis_state);
  const canonical = useAnalysisStore((s) => s.canonical);
  const phaseState = analysisState?.phase_states?.[phase];
  const runtimeStatus = analysisState?.status;
  const phaseStatus = phaseState?.status ?? "pending";

  const allMessages = useConversationStore((s) => s.messages);
  const messages = useMemo(
    () => allMessages.filter((m) => m.phase === phase),
    [allMessages, phase],
  );
  const proposalGroups = useMemo(
    () => messages.flatMap((m) => m.structured_content?.proposals ?? []),
    [messages],
  );
  const revalidationEvents = Object.values(
    canonical.revalidation_events,
  ).filter(
    (event) =>
      event.source_phase === phase || event.target_phases.includes(phase),
  );

  const totalMessageRefs = useMemo(() => {
    return messages.flatMap(
      (message) => message.structured_content?.entity_refs ?? [],
    );
  }, [messages]);

  const summary = useMemo(() => {
    const pendingProposals = proposalGroups.filter((group) =>
      group.proposals.some((proposal) => proposal.status === "pending"),
    );
    const pendingRevalidation = revalidationEvents.filter(
      (event) => event.resolution === "pending",
    );
    return {
      proposalGroups: proposalGroups.length,
      pendingProposalGroups: pendingProposals.length,
      messages: messages.length,
      pendingRevalidation: pendingRevalidation.length,
      proposals: proposalGroups.reduce(
        (total, group) => total + group.proposals.length,
        0,
      ),
    };
  }, [messages.length, proposalGroups, revalidationEvents]);

  const setInspectedTarget = useUiStore((s) => s.setInspectedTarget);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workflow =
    PHASE_WORKFLOW_COPY[phaseStatus] ?? PHASE_WORKFLOW_COPY.pending;
  const hasRevalidationQueued = summary.pendingRevalidation > 0;
  const isRunning = phaseState?.status === "running";
  const isBlocked =
    summary.pendingProposalGroups > 0 || summary.pendingRevalidation > 0;

  async function handleAction(
    key: string,
    action: () => Promise<unknown>,
  ): Promise<void> {
    setBusyAction(key);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-mono font-bold">
          {phase}
        </span>
        <div>
          <h2 className="text-2xl font-bold">{phaseName}</h2>
          <p className="text-sm text-muted-foreground">
            {runtimeStatus === "running" && isRunning
              ? "Pipeline is executing"
              : `Status: ${workflow.badge}`}
          </p>
        </div>
        <span className={`px-2 py-1 text-xs rounded-full ${workflow.style}`}>
          {workflow.badge}
        </span>
        <button
          type="button"
          onClick={() =>
            void handleAction("run-phase", () =>
              executeAppCommand({
                type: "run_phase",
                payload: { phase },
              }),
            )
          }
          disabled={busyAction != null || isRunning}
          className="ml-auto rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
        >
          {busyAction === "run-phase" ? "Running..." : "Run phase"}
        </button>
      </div>

      {runtimeStatus === "running" && isRunning ? (
        <p className="mb-2 text-sm text-muted-foreground">
          This phase is actively running and message stream may update below.
        </p>
      ) : null}

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-6">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Pending proposals</p>
          <p className="text-xl font-bold">{summary.pendingProposalGroups}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Pending reruns</p>
          <p className="text-xl font-bold">{summary.pendingRevalidation}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Messages</p>
          <p className="text-xl font-bold">{summary.messages}</p>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 mb-6">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Workflow guidance
        </h3>
        <p className="text-sm text-muted-foreground">
          {workflow.recommendation}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {isBlocked ? (
            <span className="inline-flex rounded-full bg-yellow-500/10 text-yellow-500 text-xs px-2 py-0.5">
              Review queue open
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-secondary text-xs px-2 py-0.5">
              No outstanding phase-level blockers
            </span>
          )}
          <span className="inline-flex rounded-full bg-secondary text-xs px-2 py-0.5">
            {phaseState?.pass_number ?? 1} pass
          </span>
          <Link
            to="/editor"
            className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs hover:bg-accent"
          >
            Return to Overview
          </Link>
          <Link
            to="/editor/evidence"
            className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs hover:bg-accent"
          >
            Open Evidence
          </Link>
        </div>
      </section>

      {/* Proposals */}
      {proposalGroups.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Proposals ({summary.proposals})
          </h3>
          <p className="mb-2 text-sm text-muted-foreground">
            {summary.pendingProposalGroups} group
            {summary.pendingProposalGroups === 1 ? "" : "s"} awaiting review.
          </p>
          <ProposalReview phase={phase} />
        </div>
      )}

      {hasRevalidationQueued && (
        <section className="mb-6 space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Revalidation
          </h3>
          <p className="text-sm text-muted-foreground">
            Resolve rerun/refresh actions before moving on.
          </p>
          {revalidationEvents
            .filter((event) => event.resolution === "pending")
            .map((revalidationEvent) => (
              <article
                key={revalidationEvent.id}
                role="button"
                tabIndex={0}
                className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50 cursor-pointer"
                onClick={() =>
                  setInspectedTarget({
                    entityType: "revalidation_event",
                    entityId: revalidationEvent.id,
                  })
                }
                onKeyDown={(keyboardEvent) => {
                  if (
                    keyboardEvent.key !== "Enter" &&
                    keyboardEvent.key !== " "
                  ) {
                    return;
                  }
                  keyboardEvent.preventDefault();
                  setInspectedTarget({
                    entityType: "revalidation_event",
                    entityId: revalidationEvent.id,
                  });
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {revalidationEvent.trigger_condition}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Targets phases{" "}
                      {revalidationEvent.target_phases.join(", ")} · pass{" "}
                      {revalidationEvent.pass_number}
                    </p>
                  </div>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                    {revalidationEvent.resolution}
                  </span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {revalidationEvent.description}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleAction(`approve-${revalidationEvent.id}`, () =>
                        executeAppCommand({
                          type: "approve_revalidation",
                          payload: { eventId: revalidationEvent.id },
                        }),
                      );
                    }}
                    disabled={busyAction != null}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
                  >
                    {busyAction === `approve-${revalidationEvent.id}`
                      ? "Approving..."
                      : "Approve rerun"}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleAction(`dismiss-${revalidationEvent.id}`, () =>
                        executeAppCommand({
                          type: "dismiss_revalidation",
                          payload: { eventId: revalidationEvent.id },
                        }),
                      );
                    }}
                    disabled={busyAction != null}
                    className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    {busyAction === `dismiss-${revalidationEvent.id}`
                      ? "Dismissing..."
                      : "Dismiss"}
                  </button>
                </div>
              </article>
            ))}
        </section>
      )}

      {!hasRevalidationQueued &&
        revalidationEvents.some((event) => event.resolution !== "pending") && (
          <section className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Revalidation history
            </h3>
            <div className="space-y-2">
              {revalidationEvents
                .filter((event) => event.resolution !== "pending")
                .map((revalidationEvent) => (
                  <article
                    key={revalidationEvent.id}
                    role="button"
                    tabIndex={0}
                    className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50 cursor-pointer"
                    onClick={() =>
                      setInspectedTarget({
                        entityType: "revalidation_event",
                        entityId: revalidationEvent.id,
                      })
                    }
                    onKeyDown={(keyboardEvent) => {
                      if (
                        keyboardEvent.key !== "Enter" &&
                        keyboardEvent.key !== " "
                      ) {
                        return;
                      }
                      keyboardEvent.preventDefault();
                      setInspectedTarget({
                        entityType: "revalidation_event",
                        entityId: revalidationEvent.id,
                      });
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {revalidationEvent.trigger_condition}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Targets phases{" "}
                          {revalidationEvent.target_phases.join(", ")} · pass{" "}
                          {revalidationEvent.pass_number}
                        </p>
                      </div>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                        {revalidationEvent.resolution}
                      </span>
                    </div>
                  </article>
                ))}
            </div>
          </section>
        )}

      {/* Phase messages */}
      {messages.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Messages ({messages.length})
          </h3>
          <div className="space-y-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="rounded border border-border bg-card p-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs font-medium ${msg.role === "ai" ? "text-primary" : "text-foreground"}`}
                  >
                    {msg.role === "ai" ? "AI" : "User"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                  {msg.message_type && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                      {msg.message_type}
                    </span>
                  )}
                </div>
                {msg.structured_content?.entity_refs?.length ? (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {msg.structured_content.entity_refs.map((entityRef) => (
                      <button
                        type="button"
                        key={`${entityRef.type}-${entityRef.id}`}
                        onClick={() =>
                          setInspectedTarget({
                            entityType: entityRef.type,
                            entityId: entityRef.id,
                          })
                        }
                        className="text-xs rounded-full bg-secondary px-2 py-0.5 text-muted-foreground hover:bg-accent"
                      >
                        {entityRef.type}
                      </button>
                    ))}
                  </div>
                ) : null}
                <p className="text-sm">{msg.content}</p>
                {msg.structured_content?.scenario_cards?.length ? (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {msg.structured_content.scenario_cards.length} scenario
                    links available from message.
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {!phaseState && proposalGroups.length === 0 && messages.length === 0 && (
        <p className="text-muted-foreground italic mb-6">
          This phase has not been executed yet.
        </p>
      )}

      {totalMessageRefs.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Message references
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            This phase touched {totalMessageRefs.length} canonical entity
            reference{totalMessageRefs.length === 1 ? "" : "s"} in conversation.
          </p>
        </section>
      )}
    </div>
  );
}
