import {
  setAnalysisPhaseExecutor,
  type AnalysisPhaseExecutionRequest,
  type AnalysisPhaseExecutor,
} from "../../src/services/ai/analysis-runtime";

interface AnalysisAdapter {
  runAnalysisPhase<T = unknown>(
    prompt: string,
    systemPrompt: string,
    model: string,
    schema: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<T>;
}

async function loadAnalysisAdapter(provider?: string): Promise<AnalysisAdapter> {
  if (provider === "openai") {
    return import("../services/ai/codex-adapter");
  }
  if (provider === "anthropic" || !provider) {
    return import("../services/ai/claude-adapter");
  }
  throw new Error(`Unknown provider: ${provider}. Allowed: anthropic, openai`);
}

export const serverAnalysisPhaseExecutor: AnalysisPhaseExecutor = {
  async runPhase<T = unknown>(
    request: AnalysisPhaseExecutionRequest,
  ): Promise<T> {
    const adapter = await loadAnalysisAdapter(request.provider);
    return adapter.runAnalysisPhase(
      request.prompt,
      request.systemPrompt,
      request.model,
      request.schema,
      request.signal,
    );
  },
};

let isConfigured = false;

export function configureServerAnalysisPhaseExecutor(): void {
  if (isConfigured) return;
  setAnalysisPhaseExecutor(serverAnalysisPhaseExecutor);
  isConfigured = true;
}
