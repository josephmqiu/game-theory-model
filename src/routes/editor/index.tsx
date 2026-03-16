/**
 * /editor — Overview page (default child route).
 */

import { createFileRoute } from "@tanstack/react-router";
import { useAnalysisStore } from "@/stores/analysis-store";
import { usePipelineStore } from "@/stores/pipeline-store";
import { PHASES } from "@/constants/phases";

export const Route = createFileRoute("/editor/")({
  component: OverviewPage,
});

function OverviewPage() {
  const canonical = useAnalysisStore((s) => s.canonical);
  const analysisState = usePipelineStore((s) => s.analysis_state);
  const phaseStates = analysisState?.phase_states ?? {};

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

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Overview</h2>
      <p className="text-muted-foreground mb-6">
        {analysisState
          ? analysisState.event_description
          : "Start a new analysis or open an existing .gta.json file."}
      </p>

      {/* Entity summary */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {Object.entries(entityCounts).map(([label, count]) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-card p-3"
          >
            <p className="text-xs text-muted-foreground capitalize">{label}</p>
            <p className="text-2xl font-bold">{count}</p>
          </div>
        ))}
      </div>

      {/* Phase grid */}
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Analysis Phases
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {PHASES.map(({ id, label }) => {
          const phase = phaseStates[id];
          const status = phase?.status ?? "pending";
          return (
            <div
              key={id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-mono">
                  {id}
                </span>
                <h3 className="text-sm font-medium">{label}</h3>
                <span
                  className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                    status === "complete"
                      ? "bg-green-500/10 text-green-500"
                      : status === "running"
                        ? "bg-blue-500/10 text-blue-500"
                        : status === "review_needed"
                          ? "bg-yellow-500/10 text-yellow-500"
                          : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {status === "pending" ? "Not started" : status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
