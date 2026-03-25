// analysis-run.ts — Legacy analysis run types.
// The renderer no longer manages AbortControllers or run promises directly;
// analysis-client handles all of that via HTTP/SSE.
// This file is kept for backward compat with test imports.

import type { AnalysisEntity, AnalysisRelationship } from "@/types/entity";

export interface RunLogger {
  log: (sub: string, event: string, data?: Record<string, unknown>) => void;
  warn: (sub: string, event: string, data?: Record<string, unknown>) => void;
  error: (sub: string, event: string, data?: Record<string, unknown>) => void;
  capture: (sub: string, event: string, data?: Record<string, unknown>) => void;
  flush: () => Promise<boolean>;
  entries: () => unknown[];
}

export interface AnalysisResult {
  runId: string;
  entities: AnalysisEntity[];
  relationships: AnalysisRelationship[];
}

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
