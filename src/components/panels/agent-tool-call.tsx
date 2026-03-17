/**
 * Collapsible timeline entry for a single AgentToolCallEntry.
 * Collapsed: one-line summary with status indicator and duration.
 * Expanded: full input/result JSON.
 */

import { useState } from "react";
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Loader,
  Wrench,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentToolCallEntry } from "@/stores/ai-store";

interface AgentToolCallProps {
  toolCall: AgentToolCallEntry;
}

export function summarizeToolCall(
  name: string,
  input: Record<string, unknown>,
): string {
  if ("name" in input) return `${input.name}`;
  if ("title" in input) return `${input.title}`;
  if ("statement" in input) {
    const s = String(input.statement);
    return s.length > 60 ? `${s.slice(0, 60)}...` : s;
  }
  if ("id" in input) return `id: ${input.id}`;
  return Object.keys(input).slice(0, 3).join(", ");
}

function StatusIcon({ status }: { status: AgentToolCallEntry["status"] }) {
  if (status === "pending") {
    return (
      <Loader className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
    );
  }
  if (status === "complete") {
    return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
  }
  return <XCircle className="h-3.5 w-3.5 text-red-500" />;
}

export function AgentToolCall({ toolCall }: AgentToolCallProps) {
  const [expanded, setExpanded] = useState(false);

  const summary = summarizeToolCall(toolCall.name, toolCall.input);

  return (
    <div className="rounded-md border border-border bg-background/60 text-xs">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          "flex w-full items-center gap-2 px-2.5 py-1.5 text-left",
          "hover:bg-accent/50 transition-colors rounded-md",
        )}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}

        <Wrench className="h-3 w-3 shrink-0 text-muted-foreground" />

        <span className="font-mono text-foreground">{toolCall.name}</span>

        {summary && (
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {summary}
          </span>
        )}

        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {toolCall.durationMs != null && (
            <span className="text-muted-foreground">
              {toolCall.durationMs}ms
            </span>
          )}
          <StatusIcon status={toolCall.status} />
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border px-2.5 pb-2.5 pt-2 space-y-2">
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Input
            </p>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted px-2 py-1.5 text-[11px] text-foreground">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>

          {toolCall.result !== undefined && (
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Result
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted px-2 py-1.5 text-[11px] text-foreground">
                {JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
