/**
 * Assumption card — displays an assumption with confidence and dependencies.
 */

import { AlertTriangle, CheckCircle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Assumption } from "shared/game-theory/types";

interface AssumptionCardProps {
  assumption: Assumption;
  onSelect?: () => void;
}

export function AssumptionCard({ assumption, onSelect }: AssumptionCardProps) {
  const confidence = assumption.confidence;
  const confidenceLevel =
    confidence >= 0.7 ? "high" : confidence >= 0.4 ? "medium" : "low";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50",
        (assumption.stale_markers?.length ?? 0) > 0
          ? "border-yellow-500/50"
          : "border-border",
      )}
    >
      <div className="flex items-start gap-2">
        <ConfidenceIcon level={confidenceLevel} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{assumption.statement}</p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                confidenceLevel === "high" && "bg-green-500/10 text-green-600",
                confidenceLevel === "medium" &&
                  "bg-yellow-500/10 text-yellow-600",
                confidenceLevel === "low" && "bg-red-500/10 text-red-600",
              )}
            >
              {(confidence * 100).toFixed(0)}% confidence
            </span>
            {(assumption.stale_markers?.length ?? 0) > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-600 flex items-center gap-1">
                <AlertTriangle size={10} />
                Stale
              </span>
            )}
          </div>
          {assumption.supported_by && assumption.supported_by.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
              Supported by {assumption.supported_by.length} reference(s)
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function ConfidenceIcon({ level }: { level: "high" | "medium" | "low" }) {
  switch (level) {
    case "high":
      return (
        <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
      );
    case "medium":
      return <Shield size={16} className="text-yellow-500 shrink-0 mt-0.5" />;
    case "low":
      return (
        <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
      );
  }
}
