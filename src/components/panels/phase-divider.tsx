import { cn } from "@/lib/utils";

export interface PhaseDividerProps {
  phaseNumber: number;
  phaseName: string;
  status: "running" | "completed" | "failed" | "pending";
}

// ── Helpers ──

const STATUS_TEXT_COLOR: Record<PhaseDividerProps["status"], string> = {
  running: "text-amber-500/80",
  completed: "text-zinc-500/60",
  failed: "text-red-400/60",
  pending: "text-zinc-500/30",
};

const STATUS_DOT_COLOR: Record<PhaseDividerProps["status"], string> = {
  running: "bg-amber-500 animate-pulse",
  completed: "bg-zinc-500/60",
  failed: "bg-red-400/60",
  pending: "bg-zinc-600/40",
};

// ── Component ──

export function PhaseDivider({
  phaseNumber,
  phaseName,
  status,
}: PhaseDividerProps) {
  return (
    <div className="flex items-center gap-2.5 py-2 my-1 select-none">
      {/* Left line */}
      <div className="h-px flex-1 bg-zinc-700/50" />

      {/* Status dot */}
      <div
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          STATUS_DOT_COLOR[status],
        )}
      />

      {/* Phase label */}
      <span
        className={cn(
          "shrink-0 font-[Geist,sans-serif] text-[10px] font-medium uppercase tracking-wider",
          STATUS_TEXT_COLOR[status],
        )}
      >
        Phase {phaseNumber}: {phaseName}
      </span>

      {/* Right line */}
      <div className="h-px flex-1 bg-zinc-700/50" />
    </div>
  );
}
