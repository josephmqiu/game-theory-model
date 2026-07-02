import { cn } from "@/lib/utils";
import type { ChallengeOutcome } from "@/types/entity";

export function ChallengeOutcomeChip({
  outcome,
}: {
  outcome: ChallengeOutcome;
}) {
  const styles: Record<ChallengeOutcome, string> = {
    REVISED: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    CONFIRMED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    REMOVED: "bg-red-500/15 text-red-400 border-red-500/30",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold",
        styles[outcome],
      )}
    >
      {outcome}
    </span>
  );
}
