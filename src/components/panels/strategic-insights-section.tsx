import { cn } from "@/lib/utils";
import type {
  AnalysisInsights,
  AnalysisInsightsBestResponseGroup,
  AnalysisInsightsDominance,
  AnalysisInsightsEquilibrium,
} from "@/services/analysis/analysis-insights";

interface StrategicInsightsSectionProps {
  insights: AnalysisInsights;
  sectionId?: string;
  isActive?: boolean;
}

function formatPayoffs(payoffs: [number, number]): string {
  return `(${payoffs[0]}, ${payoffs[1]})`;
}

function getDominanceLabel(dominance: AnalysisInsightsDominance): string {
  if (dominance.kind === "strict") {
    return "Strict dominant strategy";
  }

  if (dominance.kind === "weak") {
    return "Weak dominant strategy";
  }

  return "No dominant strategy";
}

function EquilibriumCard({ equilibria }: { equilibria: AnalysisInsightsEquilibrium[] }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/60 p-5">
      <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
        Pure Nash equilibria
      </h4>
      {equilibria.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {equilibria.map((equilibrium) => (
            <li
              key={equilibrium.key}
              className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3"
            >
              <p className="text-sm font-medium text-foreground">
                {equilibrium.label}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Payoffs {formatPayoffs(equilibrium.payoffs)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No pure Nash equilibrium is present in the current matrix.
        </p>
      )}
    </div>
  );
}

function BestResponsesCard({
  groups,
}: {
  groups: [AnalysisInsightsBestResponseGroup, AnalysisInsightsBestResponseGroup];
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/60 p-5">
      <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
        Best responses
      </h4>
      <div className="mt-4 space-y-4">
        {groups.map((group) => (
          <div key={group.playerId} className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              {group.playerName} best responses to {group.opponentPlayerName}
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {group.responses.map((response) => (
                <li
                  key={response.opponentStrategyId}
                  className="rounded-xl border border-border bg-card px-3 py-2"
                >
                  <span className="font-medium text-foreground">
                    Against {response.opponentStrategyName}:
                  </span>{" "}
                  {response.strategyNames.join(", ")}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function DominanceCard({
  dominance,
}: {
  dominance: [AnalysisInsightsDominance, AnalysisInsightsDominance];
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/60 p-5">
      <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
        Dominance
      </h4>
      <div className="mt-4 space-y-3">
        {dominance.map((entry) => (
          <div
            key={entry.playerId}
            className={cn(
              "rounded-xl border px-4 py-3",
              entry.kind === "none"
                ? "border-border bg-card"
                : "border-emerald-500/30 bg-emerald-500/10",
            )}
          >
            <p className="text-sm font-medium text-foreground">
              {entry.playerName}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {getDominanceLabel(entry)}
              {entry.strategyNames.length > 0
                ? `: ${entry.strategyNames.join(", ")}`
                : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StrategicInsightsSection({
  insights,
  sectionId = "analysis-insights",
  isActive = false,
}: StrategicInsightsSectionProps) {
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
        <p className={cn("text-sm font-medium", isActive ? "text-primary" : "text-muted-foreground")}>
          Strategic insights
        </p>
        <h3 className="text-xl font-semibold text-foreground">
          Game-theory analysis
        </h3>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Read the live matrix through best responses, equilibria, and dominance
          once the canonical analysis is complete.
        </p>
      </div>

      {insights.status === "blocked" ? (
        <div className="mt-6 rounded-2xl border border-border/70 bg-background/60 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
            Analysis readiness
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {insights.blockMessage}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <EquilibriumCard equilibria={insights.equilibria} />
          <BestResponsesCard groups={insights.bestResponses} />
          <DominanceCard dominance={insights.dominance} />
        </div>
      )}
    </section>
  );
}
