/**
 * Bottom status bar.
 * Shows current mode (Manual/AI), file path or "No file loaded", and active phase.
 */

import { Activity, FileText, Cpu, Hand } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { useAnalysisStore } from "@/stores/analysis-store";
import { usePipelineStore } from "@/stores/pipeline-store";

export function StatusBar() {
  const manualMode = useUiStore((s) => s.manualMode);
  const filePath = useAnalysisStore((s) => s.fileMeta.filePath);
  const analysisName = useAnalysisStore((s) => s.fileMeta.name);
  const dirty = useAnalysisStore((s) => s.fileMeta.dirty);
  const currentPhase = usePipelineStore((s) => s.analysis_state?.current_phase);
  const pipelineStatus = usePipelineStore((s) => s.analysis_state?.status);

  return (
    <div
      className={cn(
        "flex h-7 items-center justify-between border-t border-border bg-muted/50 px-3",
        "text-[11px] text-muted-foreground",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex items-center gap-1 font-medium",
            manualMode ? "text-muted-foreground" : "text-primary",
          )}
        >
          {manualMode ? (
            <>
              <Hand className="h-3 w-3" />
              Manual
            </>
          ) : (
            <>
              <Cpu className="h-3 w-3" />
              AI
            </>
          )}
        </span>

        <span className="text-border">|</span>

        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {filePath ? (
            <span className="max-w-[200px] truncate" title={filePath}>
              {analysisName}
              {dirty ? " *" : ""}
            </span>
          ) : (
            <span className="italic">No file loaded</span>
          )}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {currentPhase != null && pipelineStatus === "running" && (
          <span className="flex items-center gap-1 text-primary">
            <Activity className="h-3 w-3 animate-pulse" />
            Phase {currentPhase}
          </span>
        )}
      </div>
    </div>
  );
}
