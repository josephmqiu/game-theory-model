import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as analysisClient from "@/services/ai/analysis-client";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import type { ChallengeRecord } from "@/types/entity";
import { ChallengeOutcomeChip } from "@/components/panels/challenge-outcome-chip";

const EMPTY_CHALLENGE_LIST: ChallengeRecord[] = [];

export function ChallengeRemovedNotice({ className }: { className?: string }) {
  const challenges = useEntityGraphStore(
    (state) => state.analysis.challenges ?? EMPTY_CHALLENGE_LIST,
  );
  const removedChallenges = useMemo(
    () =>
      challenges.filter(
        (record) =>
          record.status === "resolved" &&
          record.outcome === "REMOVED" &&
          !record.viewed,
      ),
    [challenges],
  );

  if (removedChallenges.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "space-y-2 rounded-md border border-zinc-700 bg-zinc-900/95 px-4 py-2 shadow-lg backdrop-blur",
        className,
      )}
    >
      {removedChallenges.map((record) => (
        <section key={record.id} className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
              OBJECTION REMOVED ENTITY
            </h3>
            <ChallengeOutcomeChip outcome="REMOVED" />
          </div>
          <p className="text-[12px] italic leading-snug text-zinc-300">
            &quot;{record.objection}&quot;
          </p>
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void analysisClient.markChallengeViewed(record.id)}
              className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-100"
            >
              Dismiss
            </Button>
          </div>
        </section>
      ))}
    </div>
  );
}
