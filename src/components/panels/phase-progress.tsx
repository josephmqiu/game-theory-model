import { cn } from "@/lib/utils";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import {
  V3_PHASES,
  PHASE_LABELS,
  getRunnablePhaseNumber,
} from "@/types/methodology";
import {
  getPhaseFailureLabel,
  type PhaseFailureState,
} from "@/components/panels/phase-failures";

// ── Props ──

export interface PhaseProgressProps {
  className?: string;
  phaseFailures?: PhaseFailureState;
}

// ── Component ──

export function PhaseProgress({
  className,
  phaseFailures = {},
}: PhaseProgressProps) {
  const phases = useEntityGraphStore((s) => s.analysis.phases);
  const entities = useEntityGraphStore((s) => s.analysis.entities);

  const runnablePhases = phases.filter((ps) =>
    (V3_PHASES as readonly string[]).includes(ps.phase),
  );
  const completedCount = runnablePhases.filter(
    (ps) => ps.status === "complete",
  ).length;
  const totalCount = runnablePhases.length;
  const totalEntities = entities.length;
  const failedPhase = runnablePhases.find((ps) => ps.status === "failed");
  const failure =
    failedPhase !== undefined ? phaseFailures[failedPhase.phase] : undefined;

  // Find the currently running phase (first running, or first non-complete)
  const runningPhase = runnablePhases.find((ps) => ps.status === "running");
  const anyRunning = runnablePhases.some((ps) => ps.status === "running");
  const allDone =
    runnablePhases.length > 0 &&
    runnablePhases.every((ps) => ps.status === "complete");
  const allPending = runnablePhases.every((ps) => ps.status === "pending");

  // Hidden when all phases are complete/pending (no active work)
  if (!failedPhase && !anyRunning && (allDone || allPending)) {
    return null;
  }

  const progressFraction = totalCount > 0 ? completedCount / totalCount : 0;
  const currentPhaseName = runningPhase
    ? PHASE_LABELS[runningPhase.phase]
    : null;

  if (failedPhase) {
    const failureLabel = failure
      ? getPhaseFailureLabel(failure.failureKind)
      : "provider error";

    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-md border border-red-500/40 bg-zinc-900/95 px-4 py-2 shadow-lg backdrop-blur",
          className,
        )}
      >
        <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-zinc-700">
          <div
            className="h-full rounded-full bg-red-500 transition-all duration-300 ease-in-out"
            style={{ width: `${progressFraction * 100}%` }}
          />
        </div>

        <p className="truncate font-[Geist,sans-serif] text-[13px] font-medium text-zinc-200">
          <span className="text-red-400">
            Phase {getRunnablePhaseNumber(failedPhase.phase)} failed
          </span>
          <span className="mx-1.5 text-zinc-600">&mdash;</span>
          <span>{failureLabel}</span>
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border border-zinc-700 bg-zinc-900/95 px-4 py-2 shadow-lg backdrop-blur",
        allDone && "animate-fade-out",
        className,
      )}
    >
      {/* Amber progress bar */}
      <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-zinc-700">
        <div
          className="h-full rounded-full bg-amber-500 transition-all duration-300 ease-in-out"
          style={{ width: `${progressFraction * 100}%` }}
        />
      </div>

      {/* Status text */}
      <p className="truncate font-[Geist,sans-serif] text-[13px] font-medium text-zinc-300">
        {currentPhaseName && (
          <>
            <span className="text-amber-500">
              Phase{" "}
              {runningPhase
                ? getRunnablePhaseNumber(runningPhase.phase)
                : ""}:{" "}
              {currentPhaseName}
            </span>
            <span className="mx-1.5 text-zinc-600">&mdash;</span>
          </>
        )}
        <span>
          {completedCount}/{totalCount} phases complete
        </span>
        <span className="mx-1.5 text-zinc-600">&mdash;</span>
        <span>
          {totalEntities} {totalEntities === 1 ? "entity" : "entities"}
        </span>
      </p>
    </div>
  );
}
