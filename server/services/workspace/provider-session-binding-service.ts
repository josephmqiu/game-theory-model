import type { RuntimeProvider } from "../../../shared/types/analysis-runtime";
import { serverLog } from "../../utils/ai-logger";
import { recordWorkspaceRecoveryDiagnostic } from "./runtime-recovery-diagnostics";
import { getWorkspaceDatabase } from "./workspace-db";
import type { ProviderSessionBindingPurpose } from "./workspace-types";

export type ProviderSessionBindingRecoveryReason =
  | "missing_local_binding"
  | "provider_rejected_binding"
  | "resume_unsupported_for_active_turn"
  | "process_terminated"
  | "binding_provider_mismatch"
  | "binding_parse_failed";

export interface ProviderSessionBindingRecoveryOutcome {
  disposition: "resumed" | "started_fresh" | "fallback";
  reason?: ProviderSessionBindingRecoveryReason;
  message?: string;
  timestamp: number;
}

export interface ProviderSessionBindingState {
  version: 1;
  provider: RuntimeProvider;
  workspaceId: string;
  threadId: string;
  purpose: ProviderSessionBindingPurpose;
  runId?: string;
  phaseTurnId?: string;
  providerSessionId: string;
  claudeSessionId?: string;
  codexThreadId?: string;
  codexTurnId?: string;
  updatedAt: number;
  lastRecoveryOutcome?: ProviderSessionBindingRecoveryOutcome;
}

interface ProviderSessionBindingDiagnostic {
  code:
    | "recovery-scan-started"
    | "recovery-scan-completed"
    | "recovery-binding-found"
    | "recovery-binding-missing"
    | "resume-attempt"
    | "resume-succeeded"
    | "resume-failed"
    | "fallback-selected"
    | "binding-upserted"
    | "binding-cleared"
    | "run-recovery-failed";
  level: "info" | "warn" | "error";
  message: string;
  workspaceId?: string;
  threadId?: string;
  runId?: string;
  phaseTurnId?: string;
  provider?: RuntimeProvider;
  providerSessionId?: string;
  data?: Record<string, unknown>;
}

function parseBindingJson(
  raw: string,
  fallback: {
    purpose: ProviderSessionBindingPurpose;
    provider: RuntimeProvider;
    workspaceId: string;
    threadId: string;
    providerSessionId: string;
    phaseTurnId: string | null;
    runId: string | null;
    updatedAt: number;
  },
): ProviderSessionBindingState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ProviderSessionBindingState>;
    if (
      parsed &&
      parsed.version === 1 &&
      typeof parsed.provider === "string" &&
      typeof parsed.workspaceId === "string" &&
      typeof parsed.threadId === "string" &&
      typeof parsed.providerSessionId === "string" &&
      typeof parsed.updatedAt === "number" &&
      (parsed.purpose === "chat" ||
        parsed.purpose === "analysis" ||
        parsed.purpose === "recovery")
    ) {
      return {
        version: 1,
        provider: parsed.provider,
        workspaceId: parsed.workspaceId,
        threadId: parsed.threadId,
        purpose: parsed.purpose ?? fallback.purpose,
        ...((parsed.runId ?? fallback.runId)
          ? { runId: parsed.runId ?? fallback.runId ?? undefined }
          : {}),
        ...((parsed.phaseTurnId ?? fallback.phaseTurnId)
          ? {
              phaseTurnId:
                parsed.phaseTurnId ?? fallback.phaseTurnId ?? undefined,
            }
          : {}),
        providerSessionId: parsed.providerSessionId,
        ...(parsed.claudeSessionId
          ? { claudeSessionId: parsed.claudeSessionId }
          : {}),
        ...(parsed.codexThreadId
          ? { codexThreadId: parsed.codexThreadId }
          : {}),
        ...(parsed.codexTurnId ? { codexTurnId: parsed.codexTurnId } : {}),
        updatedAt: parsed.updatedAt,
        ...(parsed.lastRecoveryOutcome
          ? { lastRecoveryOutcome: parsed.lastRecoveryOutcome }
          : {}),
      };
    }
  } catch {
    // Fall through to synthetic fallback.
  }

  return {
    version: 1,
    provider: fallback.provider,
    workspaceId: fallback.workspaceId,
    threadId: fallback.threadId,
    purpose: fallback.purpose,
    ...(fallback.runId ? { runId: fallback.runId } : {}),
    ...(fallback.phaseTurnId ? { phaseTurnId: fallback.phaseTurnId } : {}),
    providerSessionId: fallback.providerSessionId,
    ...(fallback.provider === "claude"
      ? { claudeSessionId: fallback.providerSessionId }
      : { codexThreadId: fallback.providerSessionId }),
    updatedAt: fallback.updatedAt,
  };
}

export function getProviderSessionBinding(
  threadId: string,
  purpose: ProviderSessionBindingPurpose = "chat",
): ProviderSessionBindingState | null {
  const record = getWorkspaceDatabase().providerSessionBindings.getBinding(
    threadId,
    purpose,
  );
  if (!record) {
    return null;
  }

  return parseBindingJson(record.bindingJson, {
    purpose: record.purpose,
    provider: record.provider as RuntimeProvider,
    workspaceId: record.workspaceId,
    threadId: record.threadId,
    providerSessionId: record.providerSessionId,
    phaseTurnId: record.phaseTurnId,
    runId: record.runId,
    updatedAt: record.updatedAt,
  });
}

export function upsertProviderSessionBinding(
  binding: ProviderSessionBindingState,
): ProviderSessionBindingState {
  const next = {
    ...binding,
    version: 1 as const,
    updatedAt: binding.updatedAt,
  };
  getWorkspaceDatabase().providerSessionBindings.upsertBinding({
    threadId: next.threadId,
    purpose: next.purpose,
    workspaceId: next.workspaceId,
    provider: next.provider,
    providerSessionId: next.providerSessionId,
    phaseTurnId: next.phaseTurnId ?? null,
    runId: next.runId ?? null,
    bindingJson: JSON.stringify(next),
    updatedAt: next.updatedAt,
  });

  serverLog(next.runId, "provider-session-binding", "binding-upserted", {
    workspaceId: next.workspaceId,
    threadId: next.threadId,
    provider: next.provider,
    purpose: next.purpose,
    providerSessionId: next.providerSessionId,
    phaseTurnId: next.phaseTurnId ?? null,
  });
  recordWorkspaceRecoveryDiagnostic({
    code: "binding-upserted",
    level: "info",
    message: "Persisted provider session binding",
    workspaceId: next.workspaceId,
    threadId: next.threadId,
    ...(next.runId ? { runId: next.runId } : {}),
    ...(next.phaseTurnId ? { phaseTurnId: next.phaseTurnId } : {}),
    provider: next.provider,
    providerSessionId: next.providerSessionId,
    data: {
      purpose: next.purpose,
    },
  });

  return next;
}

export function clearProviderSessionBinding(
  threadId: string,
  options: {
    workspaceId?: string;
    runId?: string;
    reason?: ProviderSessionBindingRecoveryReason;
    purpose?: ProviderSessionBindingPurpose;
    phaseTurnId?: string;
    provider?: RuntimeProvider;
    providerSessionId?: string;
    message?: string;
  } = {},
): boolean {
  const purpose = options.purpose ?? "chat";
  const existing = getProviderSessionBinding(threadId, purpose);
  if (!existing) {
    return false;
  }
  if (options.runId && existing.runId && existing.runId !== options.runId) {
    return false;
  }

  getWorkspaceDatabase().providerSessionBindings.deleteBinding(
    threadId,
    purpose,
  );
  serverLog(options.runId, "provider-session-binding", "binding-cleared", {
    workspaceId: existing.workspaceId,
    threadId,
    provider: existing.provider,
    purpose: existing.purpose,
    providerSessionId: existing.providerSessionId,
    reason: options.reason ?? "unspecified",
  });
  recordWorkspaceRecoveryDiagnostic({
    code: "binding-cleared",
    level: "info",
    message: "Cleared provider session binding",
    workspaceId: existing.workspaceId,
    threadId,
    ...(options.runId ? { runId: options.runId } : {}),
    provider: existing.provider,
    providerSessionId: existing.providerSessionId,
    data: {
      purpose: existing.purpose,
      reason: options.reason ?? "unspecified",
    },
  });
  return true;
}

export function recordProviderSessionBindingDiagnostic(
  diagnostic: ProviderSessionBindingDiagnostic,
): void {
  recordWorkspaceRecoveryDiagnostic({
    code: diagnostic.code,
    level: diagnostic.level,
    message: diagnostic.message,
    ...(diagnostic.workspaceId ? { workspaceId: diagnostic.workspaceId } : {}),
    ...(diagnostic.threadId ? { threadId: diagnostic.threadId } : {}),
    ...(diagnostic.runId ? { runId: diagnostic.runId } : {}),
    ...(diagnostic.phaseTurnId ? { phaseTurnId: diagnostic.phaseTurnId } : {}),
    ...(diagnostic.provider ? { provider: diagnostic.provider } : {}),
    ...(diagnostic.providerSessionId
      ? { providerSessionId: diagnostic.providerSessionId }
      : {}),
    ...(diagnostic.data ? { data: diagnostic.data } : {}),
  });
  serverLog(diagnostic.runId, "provider-session-binding", diagnostic.code, {
    ...(diagnostic.workspaceId ? { workspaceId: diagnostic.workspaceId } : {}),
    ...(diagnostic.threadId ? { threadId: diagnostic.threadId } : {}),
    ...(diagnostic.phaseTurnId ? { phaseTurnId: diagnostic.phaseTurnId } : {}),
    ...(diagnostic.provider ? { provider: diagnostic.provider } : {}),
    ...(diagnostic.providerSessionId
      ? { providerSessionId: diagnostic.providerSessionId }
      : {}),
    ...(diagnostic.data ?? {}),
  });
}

export function createProviderSessionBindingService() {
  return {
    getBinding: getProviderSessionBinding,
    upsertBinding: upsertProviderSessionBinding,
    clearBinding: clearProviderSessionBinding,
    recordDiagnostic: recordProviderSessionBindingDiagnostic,
    recordOutcome(
      binding: ProviderSessionBindingState,
      outcome: ProviderSessionBindingRecoveryOutcome,
    ): ProviderSessionBindingState {
      return upsertProviderSessionBinding({
        ...binding,
        lastRecoveryOutcome: outcome,
        updatedAt: outcome.timestamp,
      });
    },
  };
}

export type { ProviderSessionBindingPurpose } from "./workspace-types";
