/**
 * /editor — Overview page (default child route).
 */

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAnalysisStore } from "@/stores/analysis-store";
import { usePipelineStore } from "@/stores/pipeline-store";
import { PHASES } from "@/constants/phases";
import { executeAppCommand } from "@/services/app-command-runner";
import { useConversationStore } from "@/stores/conversation-store";
import { ProposalReview } from "@/components/phases/proposal-review";
import { ManualModelingWorkbench } from "@/components/manual/manual-modeling-workbench";
import { PhaseStatusCard } from "@/components/phases/phase-status-card";

const QUICK_LINKS = [
  { label: "Evidence", to: "/editor/evidence" },
  { label: "Players", to: "/editor/players" },
  { label: "Scenarios", to: "/editor/scenarios" },
  { label: "Assumptions", to: "/editor/assumptions" },
  { label: "Game Map", to: "/editor/game-map" },
  { label: "Timeline", to: "/editor/timeline" },
  { label: "Play-outs", to: "/editor/playouts" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  pending: "Not started",
  running: "Running",
  review_needed: "Review needed",
  complete: "Complete",
  needs_rerun: "Needs rerun",
  skipped: "Skipped",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-secondary text-muted-foreground",
  running: "bg-blue-500/10 text-blue-500",
  review_needed: "bg-yellow-500/10 text-yellow-500",
  complete: "bg-green-500/10 text-green-500",
  needs_rerun: "bg-red-500/10 text-red-500",
  skipped: "bg-secondary text-muted-foreground",
};

export const Route = createFileRoute("/editor/")({
  component: OverviewPage,
});

function OverviewPage() {
  const canonical = useAnalysisStore((s) => s.canonical);
  const analysisState = usePipelineStore((s) => s.analysis_state);
  const pendingApprovals = usePipelineStore((s) =>
    Object.values(s.pending_revalidation_approvals),
  );
  const messages = useConversationStore((s) => s.messages);
  const phaseStates = analysisState?.phase_states ?? {};
  const [description, setDescription] = useState(
    analysisState?.event_description ?? "",
  );
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedStatus, setExpandedStatus] = useState(false);

  const entityCounts = {
    games: Object.keys(canonical.games).length,
    players: Object.keys(canonical.players).length,
    formalizations: Object.keys(canonical.formalizations).length,
    evidence:
      Object.keys(canonical.sources).length +
      Object.keys(canonical.observations).length +
      Object.keys(canonical.claims).length,
    assumptions: Object.keys(canonical.assumptions).length,
    scenarios: Object.keys(canonical.scenarios).length,
  };

  const pendingProposalGroups = useMemo(() => {
    const groups = messages.flatMap(
      (message) => message.structured_content?.proposals ?? [],
    );
    const uniqueByPhase = new Map<number, number>();
    return groups.filter((group) => {
      const hasPending = group.proposals.some(
        (proposal) => proposal.status === "pending",
      );
      if (!hasPending) return false;
      if (uniqueByPhase.has(group.phase)) return false;
      uniqueByPhase.set(group.phase, group.phase);
      return true;
    });
  }, [messages]);

  const pendingProposalPhases = useMemo(() => {
    const phases = new Set<number>();
    for (const message of messages) {
      for (const group of message.structured_content?.proposals ?? []) {
        const hasPending = group.proposals.some(
          (proposal) => proposal.status === "pending",
        );
        if (hasPending) {
          phases.add(group.phase);
        }
      }
    }
    return [...phases].sort((left, right) => left - right);
  }, [messages]);

  const phaseProgress = useMemo(() => {
    let completed = 0;
    let inReview = 0;
    let failed = 0;
    let running = 0;

    for (const { id } of PHASES) {
      const status = phaseStates[id]?.status ?? "pending";
      if (status === "complete") completed += 1;
      if (status === "review_needed") inReview += 1;
      if (status === "needs_rerun") failed += 1;
      if (status === "running") running += 1;
    }

    const progress = Math.round((completed / PHASES.length) * 100);
    return { completed, inReview, failed, running, progress };
  }, [phaseStates]);

  const nextTargetLabel = useMemo(() => {
    const firstPending = pendingProposalPhases[0];
    if (firstPending) return `Review proposals in Phase ${firstPending}`;
    if (pendingApprovals.length > 0) {
      return "Resolve pending revalidation request";
    }
    if (phaseProgress.running > 0) return "Wait for running phase to finish";
    if (analysisState == null) return "Start analysis to begin phase execution";
    const nextPhase = PHASES.find(({ id }) => {
      const status = phaseStates[id]?.status ?? "pending";
      return status !== "complete";
    });
    if (!nextPhase) return "All phases complete";
    return `Run next milestone at ${nextPhase.label} (Phase ${nextPhase.id})`;
  }, [
    analysisState,
    pendingApprovals.length,
    phaseProgress.running,
    pendingProposalPhases,
    phaseStates,
  ]);

  const keyFindingSummary = useMemo(() => {
    const summary = new Map<
      string,
      {
        label: string;
        count: number;
        entityType: string;
      }
    >();
    for (const message of messages) {
      for (const finding of message.structured_content?.findings_summary ?? []) {
        const existing = summary.get(finding.label);
        if (existing) {
          existing.count += finding.count;
        } else {
          summary.set(finding.label, {
            label: finding.label,
            count: finding.count,
            entityType: finding.entity_type,
          });
        }
      }
    }
    return [...summary.values()].sort((left, right) =>
      left.label.localeCompare(right.label),
    );
  }, [messages]);

  const scenarioList = useMemo(() => Object.values(canonical.scenarios), [canonical.scenarios]);
  const gameList = useMemo(() => Object.values(canonical.games), [canonical.games]);

  const activePhaseId = useMemo(() => {
    if (!analysisState) return null;
    if (analysisState.current_phase != null) return analysisState.current_phase;
    const latestComplete = PHASES.slice().reverse().find(({ id }) => {
      return phaseStates[id]?.status === "complete";
    });
    return latestComplete?.id ?? 1;
  }, [analysisState, phaseStates]);

  const nextRunLabel = busyAction === "next" ? "Running..." : "Run next phase";

  const overviewStatus = analysisState?.status ?? "not_started";
  const dashboardHeader =
    overviewStatus === "running"
      ? "Pipeline is running"
      : overviewStatus === "failed"
        ? "Pipeline is paused"
        : "Command dashboard";

  async function runCommand(
    key: string,
    action: () => Promise<unknown>,
  ): Promise<void> {
    setBusyAction(key);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Command failed.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Overview</h2>
      <p className="text-muted-foreground mb-6">
        {analysisState
          ? analysisState.event_description
          : "Start a new analysis or open an existing .gta.json file."}
      </p>

      <section className="mb-8 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-4">
          <label className="text-sm">
            <span className="mb-2 block font-medium">Situation description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="Describe the strategic situation or analysis target"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                void runCommand("start", () =>
                  executeAppCommand({
                    type: "start_analysis",
                    payload: { description: description.trim(), manual: true },
                  }),
                )
              }
              disabled={!description.trim() || busyAction != null}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              {busyAction === "start" ? "Starting..." : "Start analysis"}
            </button>
            <button
              type="button"
              onClick={() =>
                void runCommand("next", () =>
                  executeAppCommand({
                    type: "run_next_phase",
                    payload: {},
                  }),
                )
              }
              disabled={!analysisState || busyAction != null}
              className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50"
            >
              {nextRunLabel}
            </button>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground mb-2">Command dashboard</p>
          <h3 className="text-lg font-semibold">Analysis progress</h3>
          <p className="mt-1 text-sm">{dashboardHeader}</p>
          <div className="mt-4 h-2 rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${phaseProgress.progress}%` }}
            />
          </div>
          <div className="mt-2 text-sm">
            {phaseProgress.completed}/{PHASES.length} phases complete ·{" "}
            {phaseProgress.inReview} pending review · {phaseProgress.failed} rerun{" "}
            flagged
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{nextTargetLabel}</p>
          <button
            type="button"
            onClick={() => setExpandedStatus((value) => !value)}
            className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
          >
            {expandedStatus ? "Hide counts" : "Show counts"}
          </button>
          {expandedStatus && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries({
                complete: phaseProgress.completed,
                review_needed: phaseProgress.inReview,
                running: phaseProgress.running,
                failed: phaseProgress.failed,
              }).map(([status, count]) => (
                <span
                  key={status}
                  className={`text-xs px-2 py-1 rounded-full ${STATUS_STYLE[status] ?? "bg-secondary text-muted-foreground"}`}
                >
                  {count} {status.replace("_", " ")}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground mb-2">Quick links</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
              >
                {link.label}
              </Link>
            ))}
          </div>
          {activePhaseId ? (
            <Link
              to="/editor/phase/$phaseId"
              params={{ phaseId: String(activePhaseId) }}
              className="mt-3 inline-block rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
              Go to active phase ({activePhaseId})
            </Link>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 mb-8">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Key findings
        </h3>
        {keyFindingSummary.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No extracted finding summaries yet.
          </p>
        ) : (
          <ul className="grid gap-2">
            {keyFindingSummary.map((finding) => (
              <li
                key={finding.label}
                className="flex items-center justify-between text-sm"
              >
                <span>{finding.label}</span>
                <span className="text-xs rounded-full bg-secondary px-2 py-0.5">
                  {finding.count} ({finding.entityType})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-3 gap-3 mb-8">
        {Object.entries(entityCounts).map(([label, count]) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-card p-3"
          >
            <p className="text-xs text-muted-foreground capitalize">{label}</p>
            <p className="text-2xl font-bold">{count}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {label === "games"
                ? "Primary game shells"
                : label === "scenarios"
                  ? `Latest: ${scenarioList.at(-1)?.name ?? "none"}`
                  : label === "formalizations"
                    ? `Across ${gameList.length} game${gameList.length === 1 ? "" : "s"}`
                    : ""}
            </p>
          </div>
        ))}
      </section>

      <div className="mb-8">
        <ManualModelingWorkbench />
      </div>

      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Analysis Phases
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {PHASES.map(({ id, label }) => {
          const phase = phaseStates[id];
          const status = phase?.status ?? "pending";
          return (
            <div key={id} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2">
                <PhaseStatusCard
                  phase={id}
                  name={label}
                  status={status}
                  running={busyAction === `phase-${id}`}
                  onRun={
                    !analysisState
                      ? undefined
                      : () =>
                          void runCommand(`phase-${id}`, () =>
                            executeAppCommand({
                              type: "run_phase",
                              payload: { phase: id },
                            }),
                          )
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {`Status ${STATUS_LABELS[status] ?? "Not started"}`}
              </p>
              <div className="mt-2">
                <span
                  className={`text-xs px-2 py-1 rounded-full ${STATUS_STYLE[status] ?? "bg-secondary text-muted-foreground"}`}
                >
                  {status === "pending" ? "Not started" : STATUS_LABELS[status]}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <section className="rounded-lg border border-border bg-card p-4 mb-8">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Entity snapshots
        </h3>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <p>{gameList.length} game entities loaded.</p>
          <p>{scenarioList.length} scenario entities loaded.</p>
          <p>{Object.keys(canonical.players).length} player entities loaded.</p>
          <p>{Object.keys(canonical.formalizations).length} formalization entities loaded.</p>
        </div>
      </section>

      {(pendingApprovals.length > 0 || pendingProposalPhases.length > 0) && (
        <section className="mt-8 space-y-4">
          <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Pending review
          </h3>

          {pendingApprovals.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium">
                {pendingApprovals.length} revalidation approval
                {pendingApprovals.length === 1 ? "" : "s"} pending
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Open the relevant phase page to approve or dismiss rerun requests.
              </p>
            </div>
          )}

          {pendingProposalGroups.map((group) => (
            <div
              key={group.id}
              className="rounded-lg border border-border bg-card p-3"
            >
              <p className="text-xs text-muted-foreground mb-2">
                Phase {group.phase}
              </p>
              <ProposalReview phase={group.phase} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
