import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Wrench,
  Globe,
  Loader2,
  AlertCircle,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";

// ActivityEntry from shared/types/workspace-state.ts has this shape:
// { id, scope, kind, message, status?, toolName?, query?, occurredAt }
// kind values: "web-search" | "tool-call" | "model-response" | "error" | etc.

export type ActivityKind =
  | "web-search"
  | "tool-call"
  | "phase-started"
  | "phase-completed"
  | "phase-failed"
  | "model-response"
  | "error"
  | "unknown";

export interface ActivityCardProps {
  kind: ActivityKind;
  message: string;
  status?: "completed" | "failed";
  toolName?: string;
  query?: string;
  timestamp: number;
  isLive?: boolean;
  detail?: string;
}

// ── Helpers ──

const KIND_BORDER_COLOR: Record<ActivityKind, string> = {
  "tool-call": "border-l-zinc-600",
  "web-search": "border-l-blue-500/50",
  "phase-started": "border-l-amber-500/50",
  "phase-completed": "border-l-amber-500/50",
  "phase-failed": "border-l-red-500/50",
  "model-response": "border-l-zinc-700",
  error: "border-l-red-500/50",
  unknown: "border-l-zinc-700",
};

function KindIcon({ kind, isLive }: { kind: ActivityKind; isLive?: boolean }) {
  if (isLive) {
    return (
      <Loader2 size={12} className="shrink-0 text-amber-500/80 animate-spin" />
    );
  }

  switch (kind) {
    case "tool-call":
      return <Wrench size={12} className="shrink-0 text-zinc-500" />;
    case "web-search":
      return <Globe size={12} className="shrink-0 text-blue-400/70" />;
    case "phase-completed":
      return <CheckCircle2 size={12} className="shrink-0 text-amber-500/70" />;
    case "error":
    case "phase-failed":
      return <AlertCircle size={12} className="shrink-0 text-red-400/70" />;
    default:
      return <CheckCircle2 size={12} className="shrink-0 text-zinc-500/60" />;
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

// ── Component ──

export function ActivityCard({
  kind,
  message,
  status,
  toolName,
  query,
  timestamp,
  isLive,
  detail,
}: ActivityCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!detail;

  const label = toolName
    ? `${toolName}: ${message}`
    : query
      ? `${message} — ${query}`
      : message;

  return (
    <div
      className={cn(
        "rounded-sm border-l-2 my-0.5",
        KIND_BORDER_COLOR[kind] ?? "border-l-zinc-700",
      )}
    >
      {/* Collapsed row */}
      <div
        className={cn(
          "flex items-center gap-2 py-1 px-2.5 min-w-0",
          hasDetail && "cursor-pointer",
        )}
        onClick={hasDetail ? () => setExpanded((p) => !p) : undefined}
      >
        <KindIcon kind={kind} isLive={isLive} />

        <span
          className={cn(
            "truncate font-[Geist,sans-serif] text-[11px] font-medium select-none",
            status === "failed"
              ? "text-red-400/80"
              : isLive
                ? "text-zinc-300"
                : "text-zinc-500",
          )}
          title={label}
        >
          {label}
        </span>

        <span className="ml-auto shrink-0 text-[10px] text-zinc-500/50 tabular-nums select-none">
          {formatTime(timestamp)}
        </span>

        {hasDetail && (
          <ChevronDown
            size={10}
            className={cn(
              "shrink-0 text-zinc-600 transition-transform duration-150",
              expanded && "rotate-180",
            )}
          />
        )}
      </div>

      {/* Expanded detail */}
      {expanded && detail && (
        <div className="border-l border-zinc-700/50 ml-[18px] px-2.5 pb-1.5 pt-0.5 font-mono text-[10px] leading-relaxed text-zinc-500/80 whitespace-pre-wrap break-words animate-in slide-in-from-top-0.5 duration-150">
          {detail}
        </div>
      )}
    </div>
  );
}
