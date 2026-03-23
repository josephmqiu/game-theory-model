import type {
  RunFailureKind,
  RunKind,
  RunStatus,
} from "../../shared/types/api";
import type { MethodologyPhase } from "../../shared/types/methodology";
import { serverLog, serverWarn } from "../utils/ai-logger";

export type ReleaseRunOutcome = "completed" | "failed" | "cancelled";

interface RuntimeRunState {
  kind: RunKind;
  runId: string;
}

interface AcquireRunOptions {
  totalPhases?: number;
}

interface ReleaseRunOptions {
  failedPhase?: MethodologyPhase;
  failureKind?: RunFailureKind;
  failureMessage?: string;
}

type StatusChangeListener = (status: RunStatus) => void;

const listeners = new Set<StatusChangeListener>();
const deferredStaleIds = new Set<string>();

let activeRun: RuntimeRunState | null = null;
let snapshot: RunStatus = createIdleSnapshot();
let revision = 0;

function createIdleSnapshot(): RunStatus {
  return {
    status: "idle",
    kind: null,
    runId: null,
    activePhase: null,
    progress: {
      completed: 0,
      total: 0,
    },
    deferredRevalidationPending: false,
  };
}

function cloneSnapshot(status: RunStatus): RunStatus {
  return {
    ...status,
    progress: { ...status.progress },
  };
}

function emitStatusChange(
  runId: string | undefined,
  event: string,
  data?: Record<string, unknown>,
): void {
  const currentRevision = incrementRevision();
  serverLog(runId, "runtime-status", event, {
    revision: currentRevision,
    status: snapshot.status,
    kind: snapshot.kind,
    activePhase: snapshot.activePhase,
    progress: snapshot.progress,
    deferredRevalidationPending: snapshot.deferredRevalidationPending,
    ...(snapshot.failedPhase ? { failedPhase: snapshot.failedPhase } : {}),
    ...(snapshot.failureKind ? { failureKind: snapshot.failureKind } : {}),
    ...(snapshot.failureMessage
      ? { failureMessage: snapshot.failureMessage }
      : {}),
    ...(data ?? {}),
  });

  const next = cloneSnapshot(snapshot);
  for (const listener of listeners) {
    try {
      listener(next);
    } catch {
      // Listener errors must not break runtime status propagation.
    }
  }
}

function clearFailureFields(status: RunStatus): RunStatus {
  return {
    ...status,
    failedPhase: undefined,
    failureKind: undefined,
    failureMessage: undefined,
  };
}

function isActiveRun(runId: string): boolean {
  return activeRun !== null && activeRun.runId === runId;
}

export function inferFailureKind(error?: string): RunFailureKind {
  if (!error) return "unknown";
  if (/rate.?limit|429/i.test(error)) return "rate_limit";
  if (
    /mcp server|missing tool|mcp transport|nitro mcp endpoint|failed to restore .*mcp|tool list|tools:\s*\{\}/i.test(
      error,
    )
  ) {
    return "mcp_transport_error";
  }
  if (
    /invalid api key|unauthorized|forbidden|provider api|upstream api|status code 40[13]|status code 5\d\d/i.test(
      error,
    )
  ) {
    return "provider_api_error";
  }
  if (
    /not logged in|please run \/login|could not resolve authentication method|auth(?:entication)? failed|session|failed to start app-server/i.test(
      error,
    )
  ) {
    return "connector_error";
  }
  if (/timeout/i.test(error)) return "timeout";
  if (/parse|json|syntax|zod|validation/i.test(error)) return "validation";
  return "unknown";
}

export function getSnapshot(): RunStatus {
  return cloneSnapshot(snapshot);
}

export function getRevision(): number {
  return revision;
}

export function incrementRevision(): number {
  revision += 1;
  return revision;
}

export function onStatusChange(callback: StatusChangeListener): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function acquireRun(
  kind: RunKind,
  runId: string,
  options: AcquireRunOptions = {},
): boolean {
  if (activeRun) {
    serverWarn(runId, "runtime-status", "acquire-rejected", {
      requestedKind: kind,
      activeKind: activeRun.kind,
      activeRunId: activeRun.runId,
    });
    return false;
  }

  if (kind === "analysis" && deferredStaleIds.size > 0) {
    deferredStaleIds.clear();
    serverLog(runId, "runtime-status", "deferred-cleared-on-analysis-start", {});
  }

  activeRun = { kind, runId };
  snapshot = clearFailureFields({
    status: "running",
    kind,
    runId,
    activePhase: null,
    progress: {
      completed: 0,
      total: options.totalPhases ?? snapshot.progress.total,
    },
    deferredRevalidationPending: false,
  });

  emitStatusChange(runId, "acquired", {
    totalPhases: snapshot.progress.total,
  });
  return true;
}

export function setActivePhase(
  runId: string,
  activePhase: MethodologyPhase | null,
): boolean {
  if (!isActiveRun(runId) || snapshot.status !== "running") {
    serverWarn(runId, "runtime-status", "phase-update-ignored", {
      requestedPhase: activePhase,
      activeRunId: activeRun?.runId ?? null,
      status: snapshot.status,
    });
    return false;
  }

  snapshot = {
    ...snapshot,
    activePhase,
  };
  emitStatusChange(runId, "phase-set", {
    phase: activePhase,
  });
  return true;
}

export function setProgress(
  runId: string,
  progress: RunStatus["progress"],
): boolean {
  if (!isActiveRun(runId) || snapshot.status !== "running") {
    serverWarn(runId, "runtime-status", "progress-update-ignored", {
      requestedProgress: progress,
      activeRunId: activeRun?.runId ?? null,
      status: snapshot.status,
    });
    return false;
  }

  snapshot = {
    ...snapshot,
    progress: { ...progress },
  };
  emitStatusChange(runId, "progress-set", {
    completed: progress.completed,
    total: progress.total,
  });
  return true;
}

export function completePhase(runId: string): boolean {
  if (!isActiveRun(runId) || snapshot.status !== "running") {
    serverWarn(runId, "runtime-status", "phase-complete-ignored", {
      activeRunId: activeRun?.runId ?? null,
      status: snapshot.status,
    });
    return false;
  }

  snapshot = {
    ...snapshot,
    activePhase: null,
    progress: {
      completed: Math.min(
        snapshot.progress.completed + 1,
        snapshot.progress.total,
      ),
      total: snapshot.progress.total,
    },
  };
  emitStatusChange(runId, "phase-completed", {
    completed: snapshot.progress.completed,
    total: snapshot.progress.total,
  });
  return true;
}

export function releaseRun(
  runId: string,
  outcome: ReleaseRunOutcome,
  options: ReleaseRunOptions = {},
): boolean {
  if (!isActiveRun(runId)) {
    serverWarn(runId, "runtime-status", "release-ignored", {
      requestedOutcome: outcome,
      activeRunId: activeRun?.runId ?? null,
    });
    return false;
  }

  const currentKind = activeRun!.kind;
  const completedProgress = { ...snapshot.progress };
  const failedPhase = options.failedPhase ?? snapshot.activePhase ?? undefined;
  const failureMessage = options.failureMessage;
  const failureKind = options.failureKind ?? inferFailureKind(failureMessage);
  activeRun = null;

  if (outcome === "completed") {
    snapshot = createIdleSnapshot();
    snapshot.progress = completedProgress;
    snapshot.deferredRevalidationPending = deferredStaleIds.size > 0;
  } else if (outcome === "failed") {
    snapshot = {
      status: "failed",
      kind: currentKind,
      runId,
      activePhase: null,
      progress: completedProgress,
      failedPhase,
      failureKind,
      failureMessage,
      deferredRevalidationPending: false,
    };
  } else {
    snapshot = clearFailureFields({
      status: "cancelled",
      kind: currentKind,
      runId,
      activePhase: null,
      progress: completedProgress,
      deferredRevalidationPending: false,
    });
  }

  emitStatusChange(runId, "released", {
    outcome,
    deferredStaleCount: deferredStaleIds.size,
  });
  return true;
}

export function deferRevalidation(
  staleIds: string[],
  options: {
    revealWhenIdle?: boolean;
    reason?: string;
  } = {},
): void {
  if (staleIds.length === 0) {
    return;
  }

  let added = 0;
  for (const staleId of staleIds) {
    if (!deferredStaleIds.has(staleId)) {
      deferredStaleIds.add(staleId);
      added += 1;
    }
  }

  serverLog(snapshot.runId ?? undefined, "runtime-status", "deferred-queued", {
    added,
    totalDeferred: deferredStaleIds.size,
    reason: options.reason ?? "unspecified",
    revealWhenIdle: options.revealWhenIdle ?? false,
  });

  if (options.revealWhenIdle && snapshot.status === "idle") {
    revealDeferredRevalidationPrompt(options.reason ?? "idle-reveal");
  }
}

export function revealDeferredRevalidationPrompt(reason: string): boolean {
  if (snapshot.status !== "idle" || deferredStaleIds.size === 0) {
    serverWarn(snapshot.runId ?? undefined, "runtime-status", "deferred-reveal-ignored", {
      reason,
      status: snapshot.status,
      deferredStaleCount: deferredStaleIds.size,
    });
    return false;
  }

  if (snapshot.deferredRevalidationPending) {
    return true;
  }

  snapshot = {
    ...snapshot,
    deferredRevalidationPending: true,
  };
  emitStatusChange(undefined, "deferred-prompt-shown", {
    reason,
    deferredStaleCount: deferredStaleIds.size,
  });
  return true;
}

export function dismiss(
  runId?: string,
): { dismissed: boolean; deferredRevalidationPending: boolean } {
  if (snapshot.status === "running") {
    serverWarn(runId, "runtime-status", "dismiss-ignored", {
      reason: "run-active",
      activeRunId: snapshot.runId,
      kind: snapshot.kind,
    });
    return {
      dismissed: false,
      deferredRevalidationPending: snapshot.deferredRevalidationPending,
    };
  }

  if (runId) {
    if (
      (snapshot.status === "failed" || snapshot.status === "cancelled")
      && snapshot.runId === runId
    ) {
      snapshot = createIdleSnapshot();
      snapshot.deferredRevalidationPending = false;
      emitStatusChange(runId, "dismissed-terminal-status", {
        deferredStaleCount: deferredStaleIds.size,
      });

      if (deferredStaleIds.size > 0) {
        revealDeferredRevalidationPrompt("dismiss-terminal-status");
      }

      return {
        dismissed: true,
        deferredRevalidationPending: snapshot.deferredRevalidationPending,
      };
    }

    serverWarn(runId, "runtime-status", "dismiss-ignored", {
      reason: "run-id-mismatch",
      currentRunId: snapshot.runId,
      status: snapshot.status,
    });
    return {
      dismissed: false,
      deferredRevalidationPending: snapshot.deferredRevalidationPending,
    };
  }

  if (snapshot.status === "idle" && snapshot.deferredRevalidationPending) {
    snapshot = {
      ...snapshot,
      deferredRevalidationPending: false,
    };
    emitStatusChange(undefined, "dismissed-deferred-prompt", {
      deferredStaleCount: deferredStaleIds.size,
    });
    return {
      dismissed: true,
      deferredRevalidationPending: false,
    };
  }

  return {
    dismissed: false,
    deferredRevalidationPending: snapshot.deferredRevalidationPending,
  };
}

export function consumeDeferredRevalidationIds(): string[] {
  const ids = Array.from(deferredStaleIds);
  deferredStaleIds.clear();

  if (snapshot.deferredRevalidationPending) {
    snapshot = {
      ...snapshot,
      deferredRevalidationPending: false,
    };
    emitStatusChange(undefined, "deferred-consumed", {
      consumedCount: ids.length,
    });
  } else if (ids.length > 0) {
    serverLog(undefined, "runtime-status", "deferred-consumed", {
      consumedCount: ids.length,
    });
  }

  return ids;
}

export function getDeferredRevalidationIds(): string[] {
  return Array.from(deferredStaleIds);
}

export function hasDeferredRevalidationIds(): boolean {
  return deferredStaleIds.size > 0;
}

export function _resetForTest(): void {
  activeRun = null;
  snapshot = createIdleSnapshot();
  revision = 0;
  deferredStaleIds.clear();
  listeners.clear();
}
