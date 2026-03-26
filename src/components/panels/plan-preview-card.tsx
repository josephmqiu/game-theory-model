import { useState, useCallback } from "react";
import { Zap, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PHASE_LABELS, V3_PHASES } from "@/types/methodology";
import type { MethodologyPhase } from "@/types/methodology";
import type { AnalysisEffortLevel } from "../../../shared/types/analysis-runtime";

// ── Effort display labels ──

const EFFORT_LABELS: Record<AnalysisEffortLevel, string> = {
  low: "Quick",
  medium: "Standard",
  high: "Thorough",
  max: "Maximum",
};

// ── Props ──

export interface PlanPreviewCardProps {
  topic: string;
  phases: MethodologyPhase[];
  model: string;
  modelDisplayName?: string;
  effort: AnalysisEffortLevel;
  webSearch: boolean;
  onApprove: (settings: {
    phases: MethodologyPhase[];
    effort: AnalysisEffortLevel;
    webSearch: boolean;
  }) => void;
  onCancel: () => void;
}

// ── Component ──

export function PlanPreviewCard({
  topic,
  phases,
  model,
  modelDisplayName,
  effort,
  webSearch,
  onApprove,
  onCancel,
}: PlanPreviewCardProps) {
  const [selectedPhases, setSelectedPhases] = useState<MethodologyPhase[]>(
    () => phases,
  );
  const [phasesExpanded, setPhasesExpanded] = useState(false);

  const togglePhase = useCallback((phase: MethodologyPhase) => {
    setSelectedPhases((prev) => {
      if (prev.includes(phase)) {
        // Prevent deselecting the last phase
        if (prev.length <= 1) return prev;
        return prev.filter((p) => p !== phase);
      }
      // Re-insert in canonical order
      const next = [...prev, phase];
      return V3_PHASES.filter((p) => next.includes(p));
    });
  }, []);

  const handleApprove = useCallback(() => {
    onApprove({
      phases: selectedPhases,
      effort,
      webSearch,
    });
  }, [onApprove, selectedPhases, effort, webSearch]);

  return (
    <div
      className={cn(
        "w-full rounded-md border border-border/50 border-l-2 border-l-amber-500",
        "bg-card px-3 py-3",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        <span className="font-[Geist,sans-serif] text-[13px] font-semibold text-foreground">
          Analysis Plan
        </span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-6 w-6"
          onClick={onCancel}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Topic */}
      <p className="mt-2 line-clamp-2 text-sm text-foreground" title={topic}>
        {topic}
      </p>

      {/* Divider */}
      <div className="my-2 h-px bg-border/30" />

      {/* Phases section (collapsible) */}
      <div>
        <button
          type="button"
          className="flex w-full items-center gap-1.5"
          onClick={() => setPhasesExpanded((v) => !v)}
        >
          <span className="font-[Geist,sans-serif] text-[11px] uppercase tracking-wider text-muted-foreground">
            Phases
          </span>
          <span className="rounded bg-secondary px-1.5 text-[10px] text-muted-foreground">
            {selectedPhases.length}
          </span>
          <div className="flex-1" />
          {phasesExpanded ? (
            <ChevronUp className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          )}
        </button>

        {phasesExpanded && (
          <div className="mt-1.5 flex flex-col gap-1">
            {V3_PHASES.map((phase) => {
              const checked = selectedPhases.includes(phase);
              const disabled = checked && selectedPhases.length <= 1;

              return (
                <label key={phase} className="flex items-center gap-2 py-0.5">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-border accent-amber-500"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => togglePhase(phase)}
                  />
                  <span className="font-[Geist,sans-serif] text-[11px] text-foreground">
                    {PHASE_LABELS[phase]}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="my-2 h-px bg-border/30" />

      {/* Settings row */}
      <div className="flex items-center gap-2">
        <span
          className="truncate font-[Geist,sans-serif] text-[11px] text-muted-foreground"
          title={model}
        >
          {modelDisplayName ?? model}
        </span>
        <span className="rounded bg-secondary px-1.5 text-[10px] text-muted-foreground">
          {EFFORT_LABELS[effort]}
        </span>
        {webSearch && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Search
          </span>
        )}
      </div>

      {/* Action row */}
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          className="h-8 bg-amber-600 px-3 text-[12px] font-medium text-white hover:bg-amber-500"
          onClick={handleApprove}
        >
          Start Analysis
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-[12px]"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
