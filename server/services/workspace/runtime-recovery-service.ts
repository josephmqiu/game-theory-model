import {
  createProcessRuntimeError,
  createSessionRuntimeError,
  type RuntimeError,
} from "../../../shared/types/runtime-error";
import type { MethodologyPhase } from "../../../shared/types/methodology";
import * as entityGraphService from "../entity-graph-service";
import * as runtimeStatus from "../runtime-status";
import { getWorkspaceDatabase } from "./workspace-db";
import { resolveWorkspaceId } from "./workspace-context";
import {
  clearProviderSessionBinding,
  getProviderSessionBinding,
  type ProviderSessionBindingRecoveryReason,
  type ProviderSessionBindingState,
} from "./provider-session-binding-service";
import { recordWorkspaceRecoveryDiagnostic } from "./runtime-recovery-diagnostics";
import { serverLog, serverWarn } from "../../utils/ai-logger";

let startupRecoveryPromise: Promise<void> | null = null;

function createRecoveryFailure(
  run: {
    provider: string | null;
    activePhase: MethodologyPhase | null;
  },
  reason: ProviderSessionBindingRecoveryReason,
  providerSessionId?: string,
): RuntimeError {
  const provider =
    run.provider === "claude" || run.provider === "codex"
      ? run.provider
      : undefined;

  switch (reason) {
    case "missing_local_binding":
      return createSessionRuntimeError(
        "Recovery fallback: missing local provider session binding after restart",
        {
          provider,
          sessionState: "missing",
          retryable: false,
        },
      );
    case "binding_provider_mismatch":
      return createSessionRuntimeError(
        "Recovery fallback: stored provider binding belongs to a different provider",
        {
          provider,
          sessionState: "conflict",
          retryable: false,
        },
      );
    case "provider_rejected_binding":
      return createSessionRuntimeError(
        `Recovery fallback: provider rejected stored binding${providerSessionId ? ` (${providerSessionId})` : ""}`,
        {
          provider,
          sessionState: "conflict",
          retryable: false,
        },
      );
    case "binding_parse_failed":
      return createSessionRuntimeError(
        "Recovery fallback: stored provider binding could not be parsed",
        {
          provider,
          sessionState: "unknown",
          retryable: false,
        },
      );
    case "process_terminated":
    case "resume_unsupported_for_active_turn":
    default:
      return createProcessRuntimeError(
        "Recovery fallback: active provider turn was interrupted by app restart and cannot be safely resumed",
        {
          provider,
          processState: "terminated",
          retryable: false,
        },
      );
  }
}

function recordRecoveryLog(input: {
  code:
    | "recovery-scan-started"
    | "recovery-scan-completed"
    | "recovery-binding-found"
    | "recovery-binding-missing"
    | "fallback-selected"
    | "run-recovery-failed";
  level: "info" | "warn" | "error";
  message: string;
  workspaceId?: string;
  threadId?: string;
  runId?: string;
  phaseTurnId?: string;
  provider?: string | null;
  providerSessionId?: string;
  data?: Record<string, unknown>;
}): void {
  recordWorkspaceRecoveryDiagnostic({
    code: input.code,
    level: input.level,
    message: input.message,
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    ...(input.threadId ? { threadId: input.threadId } : {}),
    ...(input.runId ? { runId: input.runId } : {}),
    ...(input.phaseTurnId ? { phaseTurnId: input.phaseTurnId } : {}),
    ...(input.provider ? { provider: input.provider } : {}),
    ...(input.providerSessionId
      ? { providerSessionId: input.providerSessionId }
      : {}),
    ...(input.data ? { data: input.data } : {}),
  });

  const logData = {
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    ...(input.threadId ? { threadId: input.threadId } : {}),
    ...(input.phaseTurnId ? { phaseTurnId: input.phaseTurnId } : {}),
    ...(input.provider ? { provider: input.provider } : {}),
    ...(input.providerSessionId
      ? { providerSessionId: input.providerSessionId }
      : {}),
    ...(input.data ?? {}),
  };

  if (input.level === "error" || input.level === "warn") {
    serverWarn(input.runId, "runtime-recovery", input.code, logData);
    return;
  }
  serverLog(input.runId, "runtime-recovery", input.code, logData);
}

function appendRecoveryFailure(input: {
  run: {
    id: string;
    workspaceId: string;
    threadId: string;
    provider: string | null;
    activePhase: MethodologyPhase | null;
    progress: { completed: number; total: number };
    latestPhaseTurnId?: string;
  };
  reason: ProviderSessionBindingRecoveryReason;
  binding: ProviderSessionBindingState | null;
}): void {
  recordRecoveryLog({
    code: "fallback-selected",
    level: "warn",
    message: "Selected explicit recovery fallback for interrupted durable run",
    workspaceId: input.run.workspaceId,
    threadId: input.run.threadId,
    runId: input.run.id,
    phaseTurnId: input.run.latestPhaseTurnId,
    provider: input.binding?.provider ?? input.run.provider,
    providerSessionId: input.binding?.providerSessionId,
    data: {
      reason: input.reason,
      bindingPurpose: input.binding?.purpose ?? null,
    },
  });

  const failure = createRecoveryFailure(
    {
      provider: input.run.provider,
      activePhase: input.run.activePhase,
    },
    input.reason,
    input.binding?.providerSessionId,
  );
  const finishedAt = Date.now();
  const summaryMessage = failure.message;

  getWorkspaceDatabase().eventStore.appendEvents([
    {
      kind: "explicit" as const,
      type: "thread.activity.recorded",
      workspaceId: input.run.workspaceId,
      threadId: input.run.threadId,
      payload: {
        activityId: `activity-recovery-${input.run.id}`,
        scope: "analysis-phase",
        kind: "note",
        message: summaryMessage,
        status: "failed",
        occurredAt: finishedAt,
      },
      runId: input.run.id,
      occurredAt: finishedAt,
      producer: "runtime-recovery-service",
    },
    {
      kind: "explicit" as const,
      type: "run.failed",
      workspaceId: input.run.workspaceId,
      threadId: input.run.threadId,
      runId: input.run.id,
      payload: {
        activePhase: input.run.activePhase,
        latestPhaseTurnId: input.run.latestPhaseTurnId,
        failedPhase: input.run.activePhase ?? undefined,
        error: failure,
        finishedAt,
        summary: {
          statusMessage: summaryMessage,
          ...(input.run.activePhase
            ? { failedPhase: input.run.activePhase }
            : {}),
          completedPhases: input.run.progress.completed,
        },
      },
      occurredAt: finishedAt,
      producer: "runtime-recovery-service",
    },
    {
      kind: "explicit" as const,
      type: "run.status.changed",
      workspaceId: input.run.workspaceId,
      threadId: input.run.threadId,
      runId: input.run.id,
      payload: {
        status: "failed",
        activePhase: null,
        progress: input.run.progress,
        ...(input.run.activePhase
          ? { failedPhase: input.run.activePhase }
          : {}),
        failure,
        finishedAt,
        summary: {
          statusMessage: summaryMessage,
          ...(input.run.activePhase
            ? { failedPhase: input.run.activePhase }
            : {}),
          completedPhases: input.run.progress.completed,
        },
        latestPhaseTurnId: input.run.latestPhaseTurnId,
      },
      occurredAt: finishedAt,
      producer: "runtime-recovery-service",
    },
  ]);

  clearProviderSessionBinding(input.run.threadId, {
    runId: input.run.id,
    purpose: "analysis",
    reason: input.reason,
  });

  recordRecoveryLog({
    code: "run-recovery-failed",
    level: "error",
    message: summaryMessage,
    workspaceId: input.run.workspaceId,
    threadId: input.run.threadId,
    runId: input.run.id,
    phaseTurnId: input.run.latestPhaseTurnId,
    provider: input.run.provider,
    providerSessionId: input.binding?.providerSessionId,
    data: {
      reason: input.reason,
      failure,
    },
  });
}

async function runStartupRecovery(): Promise<void> {
  const database = getWorkspaceDatabase();

  // Hydrate the entity graph from SQLite before any consumers read it.
  const workspaceId = resolveWorkspaceId(database.workspaces);
  entityGraphService.initializeFromDatabase(workspaceId);

  // Hydrate deferred stale IDs from persisted entity stale flags.
  const staleIds = entityGraphService.getStaleEntityIds();
  if (staleIds.length > 0) {
    runtimeStatus.hydrateDeferredStaleIds(staleIds);
  }

  const runningRuns = database.runs.listRunsByStatus("running");

  recordRecoveryLog({
    code: "recovery-scan-started",
    level: "info",
    message: "Scanning durable runs for startup recovery",
    data: {
      runningRunCount: runningRuns.length,
    },
  });

  for (const run of runningRuns) {
    const binding = getProviderSessionBinding(run.threadId, "analysis");
    if (!binding) {
      recordRecoveryLog({
        code: "recovery-binding-missing",
        level: "warn",
        message: "Running durable run has no provider binding",
        workspaceId: run.workspaceId,
        threadId: run.threadId,
        runId: run.id,
        phaseTurnId: run.latestPhaseTurnId,
        provider: run.provider,
      });
      appendRecoveryFailure({
        run,
        reason: "missing_local_binding",
        binding: null,
      });
      continue;
    }

    recordRecoveryLog({
      code: "recovery-binding-found",
      level: "info",
      message: "Loaded provider binding during startup recovery",
      workspaceId: run.workspaceId,
      threadId: run.threadId,
      runId: run.id,
      phaseTurnId: run.latestPhaseTurnId,
      provider: run.provider,
      providerSessionId: binding.providerSessionId,
      data: {
        bindingPurpose: binding.purpose,
        bindingRunId: binding.runId ?? null,
      },
    });

    if (binding.provider !== run.provider) {
      appendRecoveryFailure({
        run,
        reason: "binding_provider_mismatch",
        binding,
      });
      continue;
    }

    appendRecoveryFailure({
      run,
      reason: "resume_unsupported_for_active_turn",
      binding,
    });
  }

  recordRecoveryLog({
    code: "recovery-scan-completed",
    level: "info",
    message: "Completed startup recovery scan",
    data: {
      runningRunCount: runningRuns.length,
    },
  });
}

export async function waitForRuntimeRecovery(): Promise<void> {
  if (!startupRecoveryPromise) {
    startupRecoveryPromise = runStartupRecovery().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      recordRecoveryLog({
        code: "run-recovery-failed",
        level: "error",
        message: "Startup recovery failed",
        data: {
          error: message,
        },
      });
      throw error;
    });
  }

  await startupRecoveryPromise;
}

export function _resetRuntimeRecoveryForTest(): void {
  startupRecoveryPromise = null;
}
