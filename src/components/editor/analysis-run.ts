import type { RunLogger } from "@/services/ai/ai-logger";
import type { AnalysisResult } from "@/services/ai/analysis-orchestrator";

export interface ActiveAnalysisRun {
  controller: AbortController;
  promise: Promise<AnalysisResult>;
  runId: string;
  logger: RunLogger;
}

export async function abortAnalysisRun(
  activeRun: ActiveAnalysisRun | null,
  reason: string,
): Promise<void> {
  if (!activeRun) {
    return;
  }

  try {
    activeRun.logger.warn("ui", "abort-requested", { reason });
  } catch {
    // Diagnostics must not interfere with stopping a run.
  }

  activeRun.controller.abort();

  try {
    await activeRun.promise;
  } catch {
    // The orchestrator should resolve, but abort flow should stay best-effort.
  }

  try {
    await activeRun.logger.flush();
  } catch {
    // Ignore log flush failures during abort.
  }
}
