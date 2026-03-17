/**
 * Side-by-side scenario comparison view.
 * Shows scenario cards with name, description, key differences, and probability model.
 */

import { useMemo } from "react";
import { Layers, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnalysisStore } from "@/stores/analysis-store";
import { useUiStore } from "@/stores/ui-store";
import type { Scenario } from "shared/game-theory/types/evidence";

function probabilityLabel(scenario: Scenario): string | null {
  const estimate = scenario.estimated_probability;
  if (!estimate) return null;

  if (estimate.value != null) {
    return `${(estimate.value * 100).toFixed(0)}%`;
  }
  if (estimate.min != null && estimate.max != null) {
    return `${(estimate.min * 100).toFixed(0)}–${(estimate.max * 100).toFixed(0)}%`;
  }
  return null;
}

function confidenceBadge(confidence: number): string {
  if (confidence >= 0.8)
    return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  if (confidence >= 0.5)
    return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  return "bg-red-500/15 text-red-600 dark:text-red-400";
}

interface ScenarioCardProps {
  scenario: Scenario;
  assumptions: ReadonlyArray<string>;
  onInspect: (scenarioId: string) => void;
}

function ScenarioCard({ scenario, assumptions, onInspect }: ScenarioCardProps) {
  const prob = probabilityLabel(scenario);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-card p-4",
        "transition-colors hover:border-primary/30 cursor-pointer",
      )}
      role="button"
      tabIndex={0}
      onClick={() => onInspect(scenario.id)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        onInspect(scenario.id);
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-foreground">{scenario.name}</h4>
        {prob && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
              confidenceBadge(scenario.estimated_probability?.confidence ?? 0),
            )}
          >
            {prob}
          </span>
        )}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {scenario.narrative}
      </p>

      {assumptions.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Key Assumptions
          </p>
          <ul className="space-y-0.5">
            {assumptions.map((assumption) => (
              <li
                key={assumption}
                className="truncate text-xs text-muted-foreground"
              >
                {assumption}
              </li>
            ))}
          </ul>
        </div>
      )}

      {scenario.invalidators.length > 0 && (
        <div className="space-y-1">
          <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            Invalidators
          </p>
          <ul className="space-y-0.5">
            {scenario.invalidators.map((inv) => (
              <li key={inv} className="truncate text-xs text-muted-foreground">
                {inv}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
          {scenario.probability_model}
        </span>
        <span>
          {scenario.path.length} step{scenario.path.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

export function ScenarioComparison() {
  const scenarios = useAnalysisStore((s) => s.canonical.scenarios);
  const allAssumptions = useAnalysisStore((s) => s.canonical.assumptions);
  const setInspectedTarget = useUiStore((s) => s.setInspectedTarget);

  const scenarioList = useMemo(() => Object.values(scenarios), [scenarios]);

  const assumptionLabels = useMemo(() => {
    const labels: Record<string, ReadonlyArray<string>> = {};

    for (const scenario of scenarioList) {
      labels[scenario.id] = scenario.key_assumptions.map((aId) => {
        const assumption = allAssumptions[aId];
        return assumption?.statement ?? aId;
      });
    }

    return labels;
  }, [scenarioList, allAssumptions]);

  if (scenarioList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-12 text-muted-foreground">
        <Layers className="h-8 w-8 opacity-50" />
        <p className="text-sm">No scenarios generated yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-medium text-foreground">Scenarios</h3>
        <span className="text-xs text-muted-foreground">
          {scenarioList.length} scenario{scenarioList.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div
        className={cn(
          "grid gap-3",
          scenarioList.length === 1
            ? "grid-cols-1"
            : scenarioList.length === 2
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {scenarioList.map((scenario) => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            assumptions={assumptionLabels[scenario.id] ?? []}
            onInspect={(scenarioId) =>
              setInspectedTarget({ entityType: "scenario", entityId: scenarioId })
            }
          />
        ))}
      </div>
    </div>
  );
}
