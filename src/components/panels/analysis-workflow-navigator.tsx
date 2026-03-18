import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  canTransitionToWorkflowStage,
  GUIDED_WORKFLOW_STAGE_LABELS,
  type AnalysisWorkflow,
  type AnalysisWorkflowStageSummary,
} from "@/services/analysis/analysis-workflow";
import type { GuidedWorkflowStage } from "@/types/analysis";

interface AnalysisWorkflowNavigatorProps {
  workflow: AnalysisWorkflow;
  onStageChange: (stage: GuidedWorkflowStage) => void;
}

function getStatusTone(status: AnalysisWorkflowStageSummary["status"]) {
  if (status === "complete") {
    return "complete";
  }

  if (status === "needs-attention") {
    return "attention";
  }

  if (status === "blocked") {
    return "blocked";
  }

  return "ready";
}

function StageTonePill({
  tone,
  children,
}: {
  tone: "complete" | "attention" | "blocked" | "ready";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.2em]",
        tone === "complete" && "bg-emerald-500/10 text-emerald-600",
        tone === "attention" && "bg-amber-500/10 text-amber-600",
        tone === "blocked" && "bg-rose-500/10 text-rose-600",
        tone === "ready" && "bg-primary/10 text-primary",
      )}
    >
      {children}
    </span>
  );
}

export function AnalysisWorkflowNavigator({
  workflow,
  onStageChange,
}: AnalysisWorkflowNavigatorProps) {
  const currentStage = workflow.current;
  const returnTarget = workflow.returnToStage;
  const canGoPrevious = currentStage?.previousStage
    ? canTransitionToWorkflowStage(workflow, currentStage.previousStage)
    : false;
  const canGoNext = currentStage?.nextStage
    ? canTransitionToWorkflowStage(workflow, currentStage.nextStage)
    : false;
  const canReturnToBlocker =
    returnTarget !== null &&
    returnTarget !== workflow.currentStage &&
    canTransitionToWorkflowStage(workflow, returnTarget);

  return (
    <aside
      className="sticky top-4 z-20 rounded-2xl border border-border bg-card/95 p-4 shadow-sm backdrop-blur"
      data-testid="workflow-navigator"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Guided workflow
          </p>
          <h2 className="text-base font-semibold text-foreground">
            {currentStage?.label ?? "Details"} stage
          </h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Move through the same single-page analysis in order. The navigator
            marks where you are, what is complete, and what still needs work.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => currentStage?.previousStage && onStageChange(currentStage.previousStage)}
            disabled={!canGoPrevious}
          >
            <ChevronLeft />
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => currentStage?.nextStage && onStageChange(currentStage.nextStage)}
            disabled={!canGoNext}
          >
            Next
            <ChevronRight />
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => returnTarget && onStageChange(returnTarget)}
            disabled={!canReturnToBlocker}
          >
            <RotateCcw />
            Return to blocker
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {workflow.stages.map((stage, index) => {
          const isActive = stage.isCurrent;
          const isSelectable = canTransitionToWorkflowStage(workflow, stage.stage);
          return (
            <button
              key={stage.stage}
              type="button"
              aria-pressed={isActive}
              aria-label={`${stage.label} stage`}
              data-stage={stage.stage}
              data-active={isActive}
              disabled={!isSelectable}
              onClick={() => onStageChange(stage.stage)}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70",
                isActive
                  ? "border-primary bg-primary/5 shadow-sm"
                  : isSelectable
                    ? "border-border/70 bg-background/60 hover:border-primary/40 hover:bg-primary/5"
                    : "border-border/70 bg-background/40",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {index + 1}. {GUIDED_WORKFLOW_STAGE_LABELS[stage.stage]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stage.stage === "details"
                      ? "Analysis details"
                      : stage.stage === "strategies"
                        ? "Players and strategies"
                        : stage.stage === "payoffs"
                          ? "Payoff matrix"
                          : stage.stage === "review"
                            ? "Review and status"
                            : "Strategic insights"}
                  </p>
                </div>
                <StageTonePill tone={getStatusTone(stage.status)}>
                  {stage.status === "complete"
                    ? "Complete"
                    : stage.status === "available"
                      ? "Ready"
                      : stage.status === "needs-attention"
                        ? "Needs attention"
                        : "Blocked"}
                </StageTonePill>
              </div>
              {stage.blocker ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {stage.blocker}
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  {isActive
                    ? "You are here."
                    : stage.status === "complete"
                      ? "Ready for the next step."
                      : "Review this stage when needed."}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
