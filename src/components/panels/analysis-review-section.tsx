import type {
  AnalysisSummary,
  AnalysisSummaryStatus,
} from "@/services/analysis/analysis-summary";
import { cn } from "@/lib/utils";

function getStatusDescription(status: AnalysisSummaryStatus): string {
  if (status === "complete") {
    return "Every strategy combination has a payoff pair and the manual model is ready for review.";
  }

  if (status === "incomplete") {
    return "Finish the remaining payoff cells so the analysis can stand on its own without AI help.";
  }

  return "Fix the model issues below to keep the manual analysis canonical and reviewable.";
}

interface AnalysisReviewSectionProps {
  summary: AnalysisSummary;
  sectionId?: string;
  isActive?: boolean;
}

export default function AnalysisReviewSection({
  summary,
  sectionId = "analysis-review",
  isActive = false,
}: AnalysisReviewSectionProps) {
  const remainingProfiles =
    summary.incompleteProfiles.length + summary.missingProfiles.length;

  return (
    <section
      id={sectionId}
      className={cn(
        "rounded-2xl border bg-card p-6 shadow-sm transition-colors scroll-mt-28",
        isActive ? "border-primary ring-1 ring-primary/15" : "border-border",
      )}
      data-active-stage={isActive}
      data-testid={sectionId}
      tabIndex={-1}
    >
      <div className="space-y-2">
        <p
          className={cn(
            "text-sm font-medium",
            isActive ? "text-primary" : "text-muted-foreground",
          )}
        >
          Review and status
        </p>
        <h3 className="text-xl font-semibold text-foreground">
          Manual modeling progress
        </h3>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Review completeness, strategy coverage, and any remaining issues
          before you save or move into later analysis phases.
        </p>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div
          className={`rounded-2xl border px-4 py-4 ${
            summary.status === "complete"
              ? "border-emerald-500/40 bg-emerald-500/10"
              : summary.status === "incomplete"
                ? "border-amber-500/40 bg-amber-500/10"
                : "border-rose-500/40 bg-rose-500/10"
          }`}
          data-testid="analysis-status"
        >
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Status
          </p>
          <p className="mt-2 text-lg font-semibold text-foreground">
            {summary.statusLabel}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {getStatusDescription(summary.status)}
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Strategy counts
          </p>
          <div className="mt-3 space-y-3 text-sm text-foreground">
            {summary.players.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between gap-3"
              >
                <span className="truncate">{player.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {player.strategyCount} strateg
                  {player.strategyCount === 1 ? "y" : "ies"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Payoff coverage
          </p>
          <p
            className="mt-3 text-base font-semibold text-foreground"
            data-testid="analysis-progress"
          >
            {summary.progressLabel}
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-border/70">
            <div
              className={`h-full rounded-full ${
                summary.status === "complete"
                  ? "bg-emerald-500"
                  : summary.status === "incomplete"
                    ? "bg-amber-500"
                    : "bg-rose-500"
              }`}
              style={{
                width: `${Math.round(summary.completionPercent * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-background/60 p-5">
          <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
            Remaining payoff cells
          </h4>

          {remainingProfiles > 0 ? (
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {summary.incompleteProfiles.map((profile) => (
                <li key={profile.key}>{profile.label}</li>
              ))}
              {summary.missingProfiles.map((profile) => (
                <li key={`missing-${profile.key}`}>
                  Missing profile: {profile.label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Every strategy combination has a completed payoff pair.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/60 p-5">
          <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
            Model issues
          </h4>

          {summary.issues.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {summary.issues.map((issue) => (
                <li key={`${issue.path}-${issue.message}`}>{issue.message}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No validation issues are blocking this manual analysis.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
