/**
 * Inspector panel — shows details for the selected entity.
 */

import { useUiStore } from "@/stores/ui-store";
import { useAnalysisStore } from "@/stores/analysis-store";
import type { CanonicalStore } from "shared/game-theory/types/canonical";

export function InspectorPanel() {
  const inspectedTarget = useUiStore((s) => s.inspectedTarget);
  const inspectorOpen = useUiStore((s) => s.inspectorOpen);
  const canonical = useAnalysisStore((s) => s.canonical);

  if (!inspectorOpen) {
    return null;
  }

  if (!inspectedTarget) {
    return (
      <aside className="w-64 border-l border-border shrink-0 overflow-y-auto p-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Inspector
        </h3>
        <p className="text-sm text-muted-foreground">
          Select an entity to view details
        </p>
      </aside>
    );
  }

  const { entityType, entityId } = inspectedTarget;
  const entityStoreKey = getStoreKey(entityType);
  const collection = entityStoreKey ? canonical[entityStoreKey] : null;
  const entity = collection
    ? (collection as Record<string, unknown>)[entityId]
    : null;

  return (
    <aside className="w-64 border-l border-border shrink-0 overflow-y-auto p-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        {entityType}
      </h3>
      {entity ? (
        <div className="space-y-2 text-sm">
          <p className="font-medium">{entityId}</p>
          <pre className="text-xs text-muted-foreground bg-secondary rounded p-2 overflow-x-auto">
            {JSON.stringify(entity, null, 2)}
          </pre>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Entity not found</p>
      )}
    </aside>
  );
}

function getStoreKey(entityType: string): keyof CanonicalStore | null {
  const map: Record<string, keyof CanonicalStore> = {
    game: "games",
    player: "players",
    formalization: "formalizations",
    contradiction: "contradictions",
    derivation: "derivations",
    latent_factor: "latent_factors",
    game_node: "nodes",
    game_edge: "edges",
    source: "sources",
    observation: "observations",
    claim: "claims",
    inference: "inferences",
    assumption: "assumptions",
    cross_game_link: "cross_game_links",
    scenario: "scenarios",
    playbook: "playbooks",
    escalation_ladder: "escalation_ladders",
    trust_assessment: "trust_assessments",
    eliminated_outcome: "eliminated_outcomes",
    signal_classification: "signal_classifications",
    repeated_game_pattern: "repeated_game_patterns",
    revalidation_event: "revalidation_events",
    dynamic_inconsistency_risk: "dynamic_inconsistency_risks",
    cross_game_constraint_table: "cross_game_constraint_tables",
    central_thesis: "central_theses",
    tail_risk: "tail_risks",
  };
  return map[entityType] ?? null;
}
