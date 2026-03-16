import type { EstimateValue } from "shared/game-theory/types/estimates";

import { cn } from "@/lib/utils";
import {
  ConfidenceBadge,
  confidenceLevelFromScore,
} from "@/components/ui/confidence-badge";

interface EstimateValueDisplayProps {
  readonly estimate: EstimateValue;
  readonly compact?: boolean;
  readonly className?: string;
}

function formatPointValue(estimate: EstimateValue): string {
  if (
    estimate.representation === "ordinal_rank" &&
    estimate.ordinal_rank != null
  ) {
    return `Rank #${estimate.ordinal_rank}`;
  }

  if (estimate.representation === "interval_estimate") {
    const min = estimate.min != null ? estimate.min.toFixed(2) : "?";
    const max = estimate.max != null ? estimate.max.toFixed(2) : "?";
    return `[${min}, ${max}]`;
  }

  if (estimate.value != null) {
    return estimate.value.toFixed(2);
  }

  return "--";
}

export function EstimateValueDisplay({
  estimate,
  compact = false,
  className,
}: EstimateValueDisplayProps) {
  const level = confidenceLevelFromScore(estimate.confidence);
  const displayValue = formatPointValue(estimate);

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-sm text-foreground",
          className,
        )}
      >
        <span className="font-mono font-medium">{displayValue}</span>
        <ConfidenceBadge level={level} />
      </span>
    );
  }

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-card p-3 text-card-foreground",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-medium">{displayValue}</span>
        <ConfidenceBadge level={level} />
      </div>

      <p className="mt-1.5 text-xs text-muted-foreground">
        {estimate.rationale}
      </p>

      {estimate.source_claims.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {estimate.source_claims.map((claim) => (
            <span
              key={claim}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {claim}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
