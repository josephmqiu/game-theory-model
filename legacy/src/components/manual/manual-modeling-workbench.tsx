import { useCallback, useState } from "react";
import { useAnalysisStore } from "@/stores/analysis-store";
import { useUiStore } from "@/stores/ui-store";
import type { ManualEntityType } from "./workbench-utils";
import {
  FormalizationBuilder,
  GameBuilder,
  PlayerBuilder,
  SourceBuilder,
} from "./entity-builders";
import {
  AssumptionBuilder,
  ClaimBuilder,
  InferenceBuilder,
  ObservationBuilder,
  ScenarioBuilder,
} from "./evidence-builders";

const BUILDER_TABS: ReadonlyArray<readonly [ManualEntityType, string]> = [
  ["game", "Game"],
  ["formalization", "Formalization"],
  ["player", "Player"],
  ["source", "Source"],
  ["observation", "Observation"],
  ["claim", "Claim"],
  ["inference", "Inference"],
  ["assumption", "Assumption"],
  ["scenario", "Scenario"],
] as const;

export function ManualModelingWorkbench() {
  const manualMode = useUiStore((state) => state.manualMode);
  const canonical = useAnalysisStore((state) => state.canonical);
  const [activeBuilder, setActiveBuilder] = useState<ManualEntityType>("game");
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const run = useCallback(
    (action: () => void, successMessage: string): void => {
      setError(null);
      setLastAction(null);
      try {
        action();
        setLastAction(successMessage);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Manual modeling failed.",
        );
      }
    },
    [],
  );

  const handleFormalizationCreated = useCallback((_id: string) => {
    // The scenario builder can pick up new formalizations from canonical state
    // directly; no cross-builder state sync needed.
  }, []);

  if (!manualMode) {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">
          Manual modeling
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Enable manual modeling in Settings to add games, formalizations,
          players, evidence, inferences, assumptions, and scenarios through the
          command spine.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Manual modeling
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create core entities directly through the canonical command/event
            system.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {BUILDER_TABS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveBuilder(value)}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                activeBuilder === value
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-foreground hover:bg-accent"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeBuilder === "game" && <GameBuilder run={run} />}
      {activeBuilder === "formalization" && (
        <FormalizationBuilder
          run={run}
          canonical={canonical}
          onFormalizationCreated={handleFormalizationCreated}
        />
      )}
      {activeBuilder === "player" && (
        <PlayerBuilder run={run} canonical={canonical} />
      )}
      {activeBuilder === "source" && <SourceBuilder run={run} />}
      {activeBuilder === "observation" && (
        <ObservationBuilder run={run} canonical={canonical} />
      )}
      {activeBuilder === "claim" && (
        <ClaimBuilder run={run} canonical={canonical} />
      )}
      {activeBuilder === "inference" && (
        <InferenceBuilder run={run} canonical={canonical} />
      )}
      {activeBuilder === "assumption" && (
        <AssumptionBuilder run={run} canonical={canonical} />
      )}
      {activeBuilder === "scenario" && (
        <ScenarioBuilder run={run} canonical={canonical} />
      )}

      {(error || lastAction) && (
        <div className="mt-4 rounded-lg border border-border/70 bg-background px-4 py-3">
          {error && <p className="text-sm text-red-500">{error}</p>}
          {lastAction && (
            <p className="text-sm text-foreground">{lastAction}</p>
          )}
        </div>
      )}
    </section>
  );
}
