/**
 * Phase status card — shows phase status with run button.
 */

import { Play, CheckCircle2, Clock, Loader2, AlertCircle } from "lucide-react";
import type { PhaseState } from "shared/game-theory/types/analysis-pipeline";

interface PhaseStatusCardProps {
  phase: number;
  name: string;
  status?: PhaseState["status"];
  onRun?: () => void;
  running?: boolean;
}

export function PhaseStatusCard({
  phase,
  name,
  status,
  onRun,
  running,
}: PhaseStatusCardProps) {
  const statusConfig = getStatusConfig(status);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-mono font-bold shrink-0">
          {phase}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium">{name}</h3>
          <div className="flex items-center gap-1 mt-0.5">
            <statusConfig.icon size={12} className={statusConfig.color} />
            <span className={`text-xs ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>
        </div>
        {onRun && !running && status !== "complete" && (
          <button
            type="button"
            onClick={onRun}
            className="rounded px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1"
          >
            <Play size={12} />
            Run
          </button>
        )}
        {running && <Loader2 size={16} className="text-primary animate-spin" />}
      </div>
    </div>
  );
}

function getStatusConfig(status?: PhaseState["status"]) {
  switch (status) {
    case "complete":
      return {
        icon: CheckCircle2,
        label: "Completed",
        color: "text-green-500",
      };
    case "running":
      return { icon: Loader2, label: "Running", color: "text-blue-500" };
    case "review_needed":
      return {
        icon: Clock,
        label: "Pending Review",
        color: "text-yellow-500",
      };
    case "needs_rerun":
      return { icon: AlertCircle, label: "Needs Rerun", color: "text-red-500" };
    default:
      return {
        icon: Clock,
        label: "Not started",
        color: "text-muted-foreground",
      };
  }
}
