export interface AnalysisPhaseExecutionRequest {
  provider?: string;
  prompt: string;
  systemPrompt: string;
  model: string;
  schema: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface AnalysisPhaseExecutor {
  runPhase<T = unknown>(request: AnalysisPhaseExecutionRequest): Promise<T>;
}

let analysisPhaseExecutor: AnalysisPhaseExecutor | null = null;

export function setAnalysisPhaseExecutor(
  executor: AnalysisPhaseExecutor | null,
): void {
  analysisPhaseExecutor = executor;
}

export function getAnalysisPhaseExecutor(): AnalysisPhaseExecutor | null {
  return analysisPhaseExecutor;
}
