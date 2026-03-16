/**
 * Display for EstimateValue.
 * Shows value with confidence interval as a horizontal bar visualization.
 * Color-coded by confidence level.
 */

import { cn } from "@/lib/utils";

interface EstimateDisplayProps {
  estimate: {
    value: number;
    low?: number;
    high?: number;
    confidence: number;
    rationale?: string;
  };
}

function confidenceColorClass(confidence: number): {
  bar: string;
  text: string;
  badge: string;
} {
  if (confidence >= 0.8) {
    return {
      bar: "bg-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
      badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    };
  }
  if (confidence >= 0.5) {
    return {
      bar: "bg-amber-500",
      text: "text-amber-600 dark:text-amber-400",
      badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    };
  }
  return {
    bar: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    badge: "bg-red-500/15 text-red-600 dark:text-red-400",
  };
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value * 100));
}

export function EstimateDisplay({ estimate }: EstimateDisplayProps) {
  const { value, low, high, confidence, rationale } = estimate;
  const colors = confidenceColorClass(confidence);
  const hasRange = low != null && high != null;

  const rangeWidth = hasRange ? clampPercent(high! - low!) : 0;
  const rangeLeft = hasRange ? clampPercent(low!) : 0;
  const pointLeft = clampPercent(value);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-lg font-semibold tabular-nums text-foreground">
          {value.toFixed(2)}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            colors.badge,
          )}
        >
          {(confidence * 100).toFixed(0)}% confidence
        </span>
      </div>

      <div className="relative h-3 w-full rounded-full bg-muted">
        {hasRange && (
          <div
            className={cn(
              "absolute top-0 h-full rounded-full opacity-30",
              colors.bar,
            )}
            style={{
              left: `${rangeLeft}%`,
              width: `${rangeWidth}%`,
            }}
          />
        )}

        <div
          className={cn(
            "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background",
            colors.bar,
          )}
          style={{ left: `${pointLeft}%` }}
        />
      </div>

      {hasRange && (
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{low!.toFixed(2)}</span>
          <span>{high!.toFixed(2)}</span>
        </div>
      )}

      {rationale && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {rationale}
        </p>
      )}
    </div>
  );
}
