import { useState, useCallback } from "react";
import { AlertCircle, Copy, Check, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { RuntimeError } from "../../../shared/types/runtime-error";
import type { MethodologyPhase } from "@/types/methodology";
import { PHASE_LABELS } from "@/types/methodology";

export interface DiagnosticErrorCardProps {
  error: RuntimeError;
  failedPhase?: MethodologyPhase;
  runId?: string;
  timestamp?: number;
  onRetry?: () => void;
}

const ERROR_LABELS: Record<RuntimeError["tag"], string> = {
  validation: "Validation Error",
  transport: "Transport Error",
  provider: "Provider Error",
  session: "Session Error",
  process: "Process Error",
};

const PROVIDER_REASON_LABELS: Record<string, string> = {
  rate_limit: "Rate Limited",
  unauthorized: "Unauthorized",
  unavailable: "Unavailable",
};

function getErrorLabel(error: RuntimeError): string {
  const base = ERROR_LABELS[error.tag];
  if (error.tag === "provider" && error.reason && error.reason !== "unknown") {
    const detail = PROVIDER_REASON_LABELS[error.reason];
    return detail ? `${base} — ${detail}` : base;
  }
  return base;
}

function getHintText(error: RuntimeError): string {
  switch (error.tag) {
    case "provider":
      switch (error.reason) {
        case "rate_limit":
          return "Rate limited — try again in a few minutes";
        case "unauthorized":
          return "Check provider authentication in Settings";
        case "unavailable":
          return "Provider temporarily unavailable — try a different model";
        default:
          return error.message;
      }
    case "transport":
      return "Connection interrupted — the app will retry automatically";
    case "session":
      return "Session expired — start a new thread to continue";
    case "process":
      if (error.processState === "not-installed") {
        return "Required tool is not installed — check Settings → Providers";
      }
      return "Provider process failed — try reconnecting in Settings";
    case "validation":
      return "The model returned invalid output — retrying may help";
    default:
      return (error as RuntimeError).message;
  }
}

function buildDiagnosticPayload(
  error: RuntimeError,
  failedPhase?: MethodologyPhase,
  runId?: string,
  timestamp?: number,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    tag: error.tag,
    message: error.message,
    retryable: error.retryable,
  };

  if (error.provider) payload.provider = error.provider;
  if (failedPhase) payload.phase = failedPhase;
  if (runId) payload.runId = runId;
  if (timestamp) payload.timestamp = timestamp;

  switch (error.tag) {
    case "transport":
      payload.transport = error.transport;
      if (error.statusCode !== undefined) payload.statusCode = error.statusCode;
      break;
    case "provider":
      if (error.statusCode !== undefined) payload.statusCode = error.statusCode;
      if (error.reason) payload.reason = error.reason;
      break;
    case "session":
      payload.sessionState = error.sessionState;
      break;
    case "process":
      payload.processState = error.processState;
      if (error.exitCode !== undefined) payload.exitCode = error.exitCode;
      break;
  }

  return payload;
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function DiagnosticErrorCard({
  error,
  failedPhase,
  runId,
  timestamp,
  onRetry,
}: DiagnosticErrorCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const payload = buildDiagnosticPayload(
      error,
      failedPhase,
      runId,
      timestamp,
    );
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [error, failedPhase, runId, timestamp]);

  const hintText = getHintText(error);
  const showRetry = error.retryable && onRetry;

  return (
    <div
      className={cn(
        "w-full rounded-md border-l-2 border-destructive/50 bg-destructive/5",
        "px-3 py-2.5",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <AlertCircle size={14} className="shrink-0 text-destructive" />
        <span className="text-[12px] font-medium text-foreground">
          {getErrorLabel(error)}
        </span>
      </div>

      {/* Message */}
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground line-clamp-3">
        {error.message}
      </p>

      {/* Hint */}
      <p className="mt-1 text-[10px] italic text-muted-foreground/70">
        {hintText}
      </p>

      {/* Metadata */}
      {(failedPhase || timestamp) && (
        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground/50">
          {failedPhase && <span>{PHASE_LABELS[failedPhase]}</span>}
          {failedPhase && timestamp && <span>·</span>}
          {timestamp && <span>{formatTimestamp(timestamp)}</span>}
        </div>
      )}

      {/* Actions */}
      <div className="mt-2 flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-[10px] text-muted-foreground hover:text-foreground"
          onClick={handleCopy}
        >
          {copied ? (
            <Check size={10} className="shrink-0" />
          ) : (
            <Copy size={10} className="shrink-0" />
          )}
          {copied ? "Copied" : "Copy Diagnostic Info"}
        </Button>

        {showRetry && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={onRetry}
          >
            <RefreshCw size={10} className="shrink-0" />
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
