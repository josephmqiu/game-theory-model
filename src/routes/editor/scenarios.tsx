import { createFileRoute } from "@tanstack/react-router";
import { useAnalysisStore } from "@/stores/analysis-store";
import { ScenarioComparison } from "@/components/scenarios/scenario-comparison";

export const Route = createFileRoute("/editor/scenarios")({
  component: ScenariosPage,
});

function ScenariosPage() {
  const canonical = useAnalysisStore((s) => s.canonical);
  const scenarios = Object.values(canonical.scenarios);

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Scenarios</h2>
      <p className="text-muted-foreground mb-6">
        Generated scenarios comparing strategic outcomes.
      </p>

      {scenarios.length === 0 ? (
        <p className="text-muted-foreground italic">
          No scenarios generated yet. Run Phase 9 to generate scenarios.
        </p>
      ) : (
        <ScenarioComparison />
      )}
    </div>
  );
}
