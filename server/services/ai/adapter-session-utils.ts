import {
  createProviderSessionBindingService,
  type ProviderSessionBindingRecoveryOutcome,
} from "../workspace/provider-session-binding-service";
import type { RuntimeAdapterSessionContext } from "./adapter-contract";
import type { RuntimeProvider } from "../../../shared/types/analysis-runtime";

// ── Shared binding service ──

export function getBindingService() {
  return createProviderSessionBindingService();
}

export type BindingService = ReturnType<typeof getBindingService>;

// ── Recovery outcome builder ──

export function buildRecoveryOutcome(
  disposition: ProviderSessionBindingRecoveryOutcome["disposition"],
  message?: string,
  reason?: ProviderSessionBindingRecoveryOutcome["reason"],
): ProviderSessionBindingRecoveryOutcome {
  return {
    disposition,
    ...(message ? { message } : {}),
    ...(reason ? { reason } : {}),
    timestamp: Date.now(),
  };
}

// ── Resume diagnostics ──

export function recordResumeDiag(
  bindingService: BindingService,
  context: RuntimeAdapterSessionContext,
  provider: RuntimeProvider,
  code: "resume-attempt" | "resume-succeeded" | "resume-failed",
  message: string,
  providerSessionId?: string,
  data?: Record<string, unknown>,
): void {
  bindingService.recordDiagnostic({
    code,
    level: code === "resume-failed" ? "warn" : "info",
    message,
    workspaceId: context.workspaceId,
    threadId: context.threadId,
    runId: context.runId,
    phaseTurnId: context.phaseTurnId,
    provider,
    providerSessionId,
    ...(data ? { data } : {}),
  });
}

// ── History injection ──

export function buildHistoryInjectedPrompt(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
): string {
  const history = messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");
  return `${systemPrompt}\n\n## Conversation History\n\n${history}`;
}
