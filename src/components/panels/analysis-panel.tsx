import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAnalysisSummary } from "@/services/analysis/analysis-summary";
import { createAnalysisInsights } from "@/services/analysis/analysis-insights";
import { useAnalysisStore } from "@/stores/analysis-store";
import PayoffMatrixSection from "./payoff-matrix-section";
import AnalysisReviewSection from "./analysis-review-section";
import StrategicInsightsSection from "./strategic-insights-section";

export default function AnalysisPanel() {
  const analysis = useAnalysisStore((state) => state.analysis);
  const validation = useAnalysisStore((state) => state.validation);
  const renameAnalysis = useAnalysisStore((state) => state.renameAnalysis);
  const renamePlayer = useAnalysisStore((state) => state.renamePlayer);
  const addStrategy = useAnalysisStore((state) => state.addStrategy);
  const renameStrategy = useAnalysisStore((state) => state.renameStrategy);
  const removeStrategy = useAnalysisStore((state) => state.removeStrategy);
  const setPayoff = useAnalysisStore((state) => state.setPayoff);

  // NOTE: useMemo skipped here — the jsdom test environment has a React
  // dual-instance resolution issue that prevents direct React hook imports.
  // The computation is lightweight for 2-player games and the top-bar already
  // memoizes its own copy.
  const summary = createAnalysisSummary(analysis, validation);
  const insights = createAnalysisInsights(analysis, validation);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">
            1. Analysis details
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Canonical manual model
          </h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Name the analysis and keep the workflow grounded in the current
            two-player normal-form game before you move into strategies and
            payoffs.
          </p>
        </div>

        <label className="mt-6 block max-w-3xl space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Analysis title
          </span>
          <input
            aria-label="Analysis title"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            value={analysis.name}
            onChange={(event) => renameAnalysis(event.target.value)}
            placeholder="Untitled Analysis"
          />
        </label>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">
            2. Player and strategy setup
          </p>
          <h3 className="text-xl font-semibold text-foreground">
            Players and strategies
          </h3>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Define who is playing and the ordered strategies that set the payoff
            matrix axes.
          </p>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          {analysis.players.map((player, playerIndex) => (
            <section
              key={player.id}
              className="rounded-2xl border border-border/70 bg-background/60 p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Player {playerIndex + 1}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ordered strategies define the payoff matrix axes.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addStrategy(player.id)}
                >
                  <Plus />
                  Add Strategy
                </Button>
              </div>

              <div className="mt-4 space-y-4">
                <label className="block space-y-2">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Player name
                  </span>
                  <input
                    aria-label={`Player ${playerIndex + 1} name`}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                    value={player.name}
                    onChange={(event) =>
                      renamePlayer(player.id, event.target.value)
                    }
                    placeholder={`Player ${playerIndex + 1}`}
                  />
                </label>

                <div className="space-y-3">
                  {player.strategies.map((strategy, strategyIndex) => (
                    <div
                      key={strategy.id}
                      className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-3"
                    >
                      <div className="w-8 shrink-0 text-center text-xs font-medium text-muted-foreground">
                        {strategyIndex + 1}
                      </div>
                      <input
                        aria-label={`Player ${playerIndex + 1} strategy ${strategyIndex + 1}`}
                        className="flex-1 rounded-lg border border-transparent bg-transparent px-2 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-background"
                        value={strategy.name}
                        onChange={(event) =>
                          renameStrategy(
                            player.id,
                            strategy.id,
                            event.target.value,
                          )
                        }
                        placeholder={`Strategy ${strategyIndex + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove Player ${playerIndex + 1} strategy ${strategyIndex + 1}`}
                        onClick={() => removeStrategy(player.id, strategy.id)}
                        disabled={player.strategies.length <= 1}
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      </section>

      <PayoffMatrixSection
        analysis={analysis}
        setPayoff={setPayoff}
        insights={insights}
      />

      <AnalysisReviewSection summary={summary} />

      <StrategicInsightsSection insights={insights} />
    </div>
  );
}
