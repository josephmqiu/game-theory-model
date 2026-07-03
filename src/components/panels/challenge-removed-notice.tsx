import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as analysisClient from "@/services/ai/analysis-client";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import type { ChallengeRecord } from "@/types/entity";
import { ChallengeOutcomeChip } from "@/components/panels/challenge-outcome-chip";

const EMPTY_CHALLENGE_LIST: ChallengeRecord[] = [];

export function ChallengeRemovedNotice({ className }: { className?: string }) {
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(
    () => new Set(),
  );
  const prefersReducedMotionRef = useRef(false);
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

  useEffect(() => {
    prefersReducedMotionRef.current =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const handleDismiss = useCallback((recordId: string) => {
    if (!prefersReducedMotionRef.current) {
      setDismissingIds((current) => new Set(current).add(recordId));
    }
    void analysisClient.markChallengeViewed(recordId);
  }, []);

  if (removedChallenges.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "overlay-card-motion space-y-2 rounded-md border border-zinc-700 bg-zinc-900/95 px-4 py-2 shadow-lg backdrop-blur opacity-100 transition-[opacity,transform] duration-[140ms] ease-out translate-y-0 motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
        className,
      )}
    >
      {removedChallenges.map((record) => (
        <section
          key={record.id}
          className={cn(
            "space-y-1.5 opacity-100 transition-[opacity,transform] duration-[140ms] ease-out translate-y-0 motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
            dismissingIds.has(record.id) && "translate-y-1 opacity-0",
          )}
        >
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
              onClick={() => handleDismiss(record.id)}
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
