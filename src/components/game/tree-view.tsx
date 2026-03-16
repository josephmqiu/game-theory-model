/**
 * Extensive-form game tree placeholder.
 * Shows game name, node count, and a message pointing to future @xyflow/react integration.
 */

import { GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnalysisStore } from "@/stores/analysis-store";
import type { Formalization } from "shared/game-theory/types/formalizations";

interface TreeViewProps {
  gameId: string;
  formalizationId: string;
}

function isExtensiveForm(
  f: Formalization,
): f is Extract<Formalization, { kind: "extensive_form" }> {
  return f.kind === "extensive_form";
}

export function TreeView({ gameId, formalizationId }: TreeViewProps) {
  const game = useAnalysisStore((s) => s.canonical.games[gameId]);
  const formalization = useAnalysisStore(
    (s) => s.canonical.formalizations[formalizationId],
  );
  const nodes = useAnalysisStore((s) => s.canonical.nodes);

  if (!game) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Game not found
      </div>
    );
  }

  if (!formalization || !isExtensiveForm(formalization)) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        No extensive-form formalization available
      </div>
    );
  }

  const nodeCount = Object.values(nodes).filter(
    (n) => n.formalization_id === formalizationId,
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <GitBranch className="h-4 w-4" />
        <span>{game.name}</span>
      </div>

      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3",
          "rounded-lg border border-dashed border-border bg-muted/30 p-12",
        )}
      >
        <GitBranch className="h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">
          {nodeCount} node{nodeCount !== 1 ? "s" : ""} in tree
        </p>
        <p className="max-w-xs text-center text-xs text-muted-foreground">
          Tree visualization coming soon — connect @xyflow/react
        </p>
        {formalization.root_node_id && (
          <p className="text-xs text-muted-foreground">
            Root:{" "}
            <span className="font-mono">
              {nodes[formalization.root_node_id]?.label ??
                formalization.root_node_id}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
