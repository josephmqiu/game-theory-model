/**
 * Evidence browser. Shows sources, observations, claims, and inferences
 * with type badges and confidence indicators.
 */

import { useMemo } from "react";
import { BookOpen, Eye, MessageSquare, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnalysisStore } from "@/stores/analysis-store";
import type {
  Source,
  Observation,
  Claim,
  Inference,
} from "shared/game-theory/types/evidence";

type EvidenceEntry =
  | { kind: "source"; data: Source }
  | { kind: "observation"; data: Observation }
  | { kind: "claim"; data: Claim }
  | { kind: "inference"; data: Inference };

const BADGE_STYLES: Record<EvidenceEntry["kind"], string> = {
  source: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  observation: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  claim: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  inference: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
};

const KIND_ICONS: Record<EvidenceEntry["kind"], typeof BookOpen> = {
  source: BookOpen,
  observation: Eye,
  claim: MessageSquare,
  inference: Lightbulb,
};

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "text-emerald-600 dark:text-emerald-400";
  if (confidence >= 0.5) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function entryLabel(entry: EvidenceEntry): string {
  switch (entry.kind) {
    case "source":
      return entry.data.title ?? entry.data.url ?? entry.data.id;
    case "observation":
      return entry.data.text;
    case "claim":
      return entry.data.statement;
    case "inference":
      return entry.data.statement;
  }
}

function entryConfidence(entry: EvidenceEntry): number | null {
  switch (entry.kind) {
    case "claim":
      return entry.data.confidence;
    case "inference":
      return entry.data.confidence;
    default:
      return null;
  }
}

export function EvidenceNotebook() {
  const sources = useAnalysisStore((s) => s.canonical.sources);
  const observations = useAnalysisStore((s) => s.canonical.observations);
  const claims = useAnalysisStore((s) => s.canonical.claims);
  const inferences = useAnalysisStore((s) => s.canonical.inferences);

  const entries: ReadonlyArray<EvidenceEntry> = useMemo(() => {
    const result: EvidenceEntry[] = [];

    for (const data of Object.values(sources)) {
      result.push({ kind: "source", data });
    }
    for (const data of Object.values(observations)) {
      result.push({ kind: "observation", data });
    }
    for (const data of Object.values(claims)) {
      result.push({ kind: "claim", data });
    }
    for (const data of Object.values(inferences)) {
      result.push({ kind: "inference", data });
    }

    return result;
  }, [sources, observations, claims, inferences]);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-12 text-muted-foreground">
        <BookOpen className="h-8 w-8 opacity-50" />
        <p className="text-sm">No evidence collected yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1 pb-2">
        <h3 className="text-sm font-medium text-foreground">Evidence</h3>
        <span className="text-xs text-muted-foreground">
          {entries.length} item{entries.length !== 1 ? "s" : ""}
        </span>
      </div>

      <ul className="space-y-1">
        {entries.map((entry) => {
          const Icon = KIND_ICONS[entry.kind];
          const confidence = entryConfidence(entry);

          return (
            <li
              key={`${entry.kind}-${entry.data.id}`}
              className={cn(
                "flex items-start gap-2 rounded-md border border-border bg-card p-3",
                "transition-colors hover:bg-accent/50",
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm text-foreground">
                  {entryLabel(entry)}
                </p>

                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
                      BADGE_STYLES[entry.kind],
                    )}
                  >
                    {entry.kind}
                  </span>

                  {confidence != null && (
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        confidenceColor(confidence),
                      )}
                    >
                      {(confidence * 100).toFixed(0)}% confidence
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
