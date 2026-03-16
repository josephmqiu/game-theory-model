import type { StaleMarker } from "shared/game-theory/types/canonical";

import { cn } from "@/lib/utils";

interface StaleBadgeProps {
  readonly marker: StaleMarker;
  readonly className?: string;
}

export function StaleBadge({ marker, className }: StaleBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive",
        className,
      )}
      title={`Stale since ${marker.stale_since}: ${marker.reason}`}
    >
      <svg
        className="h-3 w-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      Stale
    </span>
  );
}
