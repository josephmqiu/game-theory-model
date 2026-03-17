/**
 * PhaseProgressPanel — compact vertical checklist of 10 analysis phases.
 * Each row shows a filled/empty indicator, the phase name, entity counts,
 * and any coverage warnings.
 */

import { cn } from "@/lib/utils";
import type { PhaseProgress } from "shared/game-theory/types/agent";

interface PhaseProgressProps {
  phases: PhaseProgress[];
  className?: string;
}

export function PhaseProgressPanel({ phases, className }: PhaseProgressProps) {
  return (
    <div
      role="list"
      aria-label="Analysis phase progress"
      className={cn("space-y-1", className)}
    >
      {phases.map((phase) => (
        <PhaseRow key={phase.phase} phase={phase} />
      ))}
    </div>
  );
}

function PhaseRow({ phase }: { phase: PhaseProgress }) {
  const entitySummary = Object.entries(phase.entity_counts)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${count} ${name.replace(/_/g, " ")}`)
    .join(", ");

  return (
    <div role="listitem" className="flex items-start gap-2 px-2 py-1">
      <div
        aria-hidden="true"
        className={cn(
          "mt-1 h-2.5 w-2.5 shrink-0 rounded-full border",
          phase.has_entities
            ? "border-primary bg-primary"
            : "border-muted-foreground/40 bg-transparent",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-foreground">
            {phase.name}
          </span>
          {entitySummary && (
            <span className="truncate text-[10px] text-muted-foreground">
              {entitySummary}
            </span>
          )}
        </div>
        {phase.coverage_warnings.map((warning, i) => (
          <p
            key={`${phase.phase}-warning-${i}`}
            className="text-[10px] text-yellow-600 dark:text-yellow-400"
          >
            {warning}
          </p>
        ))}
      </div>
    </div>
  );
}
