import type { MethodologyPhase } from "@/types/methodology";
import { V1_PHASES } from "@/types/methodology";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import { useAIStore } from "@/stores/ai-store";
import { streamChat } from "@/services/ai/ai-service";
import type { AIStreamChunk } from "@/services/ai/ai-types";
import { createPhaseWorker } from "@/services/ai/phase-worker";
import type { RunContext, RunLogger } from "@/services/ai/ai-logger";
import { timer } from "@/services/ai/ai-logger";
import { getOrchestratorTimeouts } from "@/services/ai/orchestrator-prompt-optimizer";
import { useAnalysisRunStore } from "@/stores/analysis-run-store";

export type AnalysisFailureKind = "timeout" | "parse-error" | "provider-error";

export interface AnalysisResult {
  status: "success" | "failed" | "aborted";
  phasesCompleted: number;
  totalEntities: number;
  runId: string;
  failedPhase?: MethodologyPhase;
  failureKind?: AnalysisFailureKind;
}

export interface OrchestratorCallbacks {
  onPhaseStart: (phase: MethodologyPhase) => void;
  onPhaseComplete: (phase: MethodologyPhase, entityCount: number) => void;
  onPhaseFailed: (phase: MethodologyPhase, error: string) => void;
}

export interface OrchestratorConfig {
  topic: string;
  signal: AbortSignal;
  callbacks: OrchestratorCallbacks;
  run: RunContext;
}

export interface RevalidationConfig {
  signal: AbortSignal;
  callbacks: OrchestratorCallbacks;
  run: RunContext;
}

type SupportedPhase = Extract<
  MethodologyPhase,
  "situational-grounding" | "player-identification" | "baseline-model"
>;

interface PhaseSuccessResult {
  status: "success";
  entityCount: number;
  attemptsUsed: number;
}

interface PhaseFailureResult {
  status: "failed";
  error: string;
  failureKind: AnalysisFailureKind;
}

interface PhaseAbortResult {
  status: "aborted";
}

type PhaseExecutionResult =
  | PhaseSuccessResult
  | PhaseFailureResult
  | PhaseAbortResult;

const SUPPORTED_PHASES: SupportedPhase[] = V1_PHASES.filter(
  (p): p is SupportedPhase =>
    p === "situational-grounding" ||
    p === "player-identification" ||
    p === "baseline-model",
);

const MAX_RETRIES = 2;

function resolveProvider(model: string): string | undefined {
  const groups = useAIStore.getState().modelGroups ?? [];
  return groups.find((g) => g.models.some((m) => m.value === model))?.provider;
}

function buildPriorContext(
  completedPhases: MethodologyPhase[],
): string | undefined {
  if (completedPhases.length === 0) return undefined;

  const store = useEntityGraphStore.getState();
  const priorEntities = store.analysis.entities.filter((e) =>
    completedPhases.includes(e.phase),
  );

  if (priorEntities.length === 0) return undefined;

  const summary = priorEntities.map((e) => ({
    id: e.id,
    type: e.type,
    name:
      "name" in e.data
        ? e.data.name
        : "content" in e.data
          ? e.data.content
          : e.id,
    phase: e.phase,
  }));

  return JSON.stringify(summary);
}

function getTotalEntityCount(): number {
  return useEntityGraphStore.getState().analysis.entities.length;
}

function classifyFailureKind(
  message: string,
  fallback: AnalysisFailureKind = "provider-error",
): AnalysisFailureKind {
  return /timed?\s*out|timeout/i.test(message) ? "timeout" : fallback;
}

async function accumulateStream(
  stream: AsyncGenerator<AIStreamChunk>,
  logger: RunLogger,
  phase: MethodologyPhase,
  attempt: number,
  signal?: AbortSignal,
): Promise<string> {
  let accumulated = "";
  let chunkCount = 0;

  for await (const chunk of stream) {
    if (chunk.type === "text") {
      accumulated += chunk.content;
      chunkCount++;
    } else if (chunk.type === "thinking") {
      logger.log("orchestrator", "thinking-chunk", {
        phase,
        attempt,
        thinkingLen: chunk.content.length,
      });
    } else if (chunk.type === "error") {
      throw new Error(chunk.content);
    }
  }

  if (signal?.aborted) {
    throw new DOMException("Stream aborted", "AbortError");
  }

  logger.log("orchestrator", "stream-complete", {
    phase,
    attempt,
    totalChunks: chunkCount,
    accumulatedLen: accumulated.length,
  });

  return accumulated;
}

async function runSinglePhase(params: {
  phase: SupportedPhase;
  topic: string;
  priorPhases: MethodologyPhase[];
  model: string;
  provider?: string;
  signal: AbortSignal;
  callbacks: OrchestratorCallbacks;
  run: RunContext;
}): Promise<PhaseExecutionResult> {
  const { phase, topic, priorPhases, model, provider, signal, callbacks, run } =
    params;

  const phaseTimer = timer();
  const worker = createPhaseWorker(phase);
  const priorContext = buildPriorContext(priorPhases);
  const { system, user } = worker.buildPrompt(topic, priorContext);

  if (signal.aborted) {
    return { status: "aborted" };
  }

  callbacks.onPhaseStart(phase);
  useAnalysisRunStore.getState().setPhase(phase);
  useEntityGraphStore.getState().setPhaseStatus(phase, "running");
  run.logger.log("orchestrator", "phase-start", { phase });

  let lastError = "";
  let lastFailureKind: AnalysisFailureKind = "provider-error";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal.aborted) {
      useEntityGraphStore.getState().setPhaseStatus(phase, "pending");
      return { status: "aborted" };
    }

    const attemptNumber = attempt + 1;
    useAnalysisRunStore.getState().setAttempt(attemptNumber);
    run.logger.log("orchestrator", "attempt-start", {
      phase,
      attempt: attemptNumber,
      maxAttempts: MAX_RETRIES + 1,
    });

    try {
      const timeouts = getOrchestratorTimeouts(
        system.length + user.length,
        model,
      );
      const stream = streamChat(
        system,
        [{ role: "user", content: user }],
        model,
        timeouts,
        provider,
        signal,
        run.runId,
      );
      const raw = await accumulateStream(
        stream,
        run.logger,
        phase,
        attemptNumber,
        signal,
      );

      const result = worker.parseResponse(raw);
      if (result.success) {
        const { entities, relationships } = result.data;
        useEntityGraphStore.getState().addEntities(entities, relationships);
        useEntityGraphStore.getState().setPhaseStatus(phase, "complete");

        callbacks.onPhaseComplete(phase, entities.length);
        run.logger.log("orchestrator", "parse-success", {
          phase,
          attempt: attemptNumber,
          entities: entities.length,
          relationships: relationships.length,
        });
        run.logger.log("orchestrator", "phase-complete", {
          phase,
          elapsedMs: phaseTimer.elapsed(),
          entities: entities.length,
          attemptsUsed: attemptNumber,
        });
        await run.logger.flush();
        return {
          status: "success",
          entityCount: entities.length,
          attemptsUsed: attemptNumber,
        };
      }

      lastError = result.error;
      lastFailureKind = "parse-error";
      run.logger.capture("orchestrator", "raw-response", {
        phase,
        attempt: attemptNumber,
        raw,
      });
      run.logger.warn("orchestrator", "parse-failed", {
        phase,
        attempt: attemptNumber,
        error: lastError,
      });
    } catch (error) {
      if (signal.aborted) {
        useEntityGraphStore.getState().setPhaseStatus(phase, "pending");
        return { status: "aborted" };
      }

      lastError = error instanceof Error ? error.message : "Unknown error";
      lastFailureKind = classifyFailureKind(lastError);
      run.logger.error("orchestrator", "attempt-error", {
        phase,
        attempt: attemptNumber,
        error: lastError,
      });
    }
  }

  useEntityGraphStore.getState().setPhaseStatus(phase, "failed");
  callbacks.onPhaseFailed(phase, lastError);
  useAnalysisRunStore.getState().failRun(phase, lastFailureKind, lastError);
  run.logger.error("orchestrator", "phase-failed", {
    phase,
    elapsedMs: phaseTimer.elapsed(),
    failureKind: lastFailureKind,
    lastError,
  });
  await run.logger.flush();

  return {
    status: "failed",
    error: lastError,
    failureKind: lastFailureKind,
  };
}

export async function runMethodologyAnalysis(
  config: OrchestratorConfig,
): Promise<AnalysisResult> {
  const { topic, signal, callbacks, run } = config;
  const analysisTimer = timer();
  useAnalysisRunStore.getState().startRun(run.runId, MAX_RETRIES + 1);
  const completedPhases: MethodologyPhase[] = [];
  const model = useAIStore.getState().model;
  const provider = resolveProvider(model);
  let result: AnalysisResult = {
    status: "aborted",
    phasesCompleted: 0,
    totalEntities: getTotalEntityCount(),
    runId: run.runId,
  };

  run.logger.log("orchestrator", "analysis-start", {
    mode: "analysis",
    topic: topic.slice(0, 80),
    model,
    provider: provider ?? "unknown",
    phases: SUPPORTED_PHASES.length,
  });

  try {
    for (const phase of SUPPORTED_PHASES) {
      const phaseResult = await runSinglePhase({
        phase,
        topic,
        priorPhases: completedPhases,
        model,
        provider,
        signal,
        callbacks,
        run,
      });

      if (phaseResult.status === "success") {
        completedPhases.push(phase);
        continue;
      }

      if (phaseResult.status === "failed") {
        result = {
          status: "failed",
          phasesCompleted: completedPhases.length,
          totalEntities: getTotalEntityCount(),
          runId: run.runId,
          failedPhase: phase,
          failureKind: phaseResult.failureKind,
        };
        break;
      }

      result = {
        status: "aborted",
        phasesCompleted: completedPhases.length,
        totalEntities: getTotalEntityCount(),
        runId: run.runId,
      };
      break;
    }

    if (completedPhases.length === SUPPORTED_PHASES.length) {
      result = {
        status: "success",
        phasesCompleted: completedPhases.length,
        totalEntities: getTotalEntityCount(),
        runId: run.runId,
      };
      useAnalysisRunStore.getState().completeRun();
    } else if (signal.aborted && result.status !== "failed") {
      run.logger.warn("orchestrator", "analysis-aborted", {
        mode: "analysis",
        phasesCompleted: completedPhases.length,
      });
      result = {
        status: "aborted",
        phasesCompleted: completedPhases.length,
        totalEntities: getTotalEntityCount(),
        runId: run.runId,
      };
      useAnalysisRunStore.getState().abortRun();
    }

    return result;
  } finally {
    run.logger.log("orchestrator", "analysis-finished", {
      mode: "analysis",
      status: result.status,
      phasesCompleted: result.phasesCompleted,
      totalEntities: result.totalEntities,
      failedPhase: result.failedPhase,
      failureKind: result.failureKind,
      elapsedMs: analysisTimer.elapsed(),
    });
    await run.logger.flush();
  }
}

export async function revalidateStaleEntities(
  config: RevalidationConfig,
): Promise<AnalysisResult> {
  const { signal, callbacks, run } = config;
  const analysisTimer = timer();
  const store = useEntityGraphStore.getState();
  const staleIds = store.getStaleEntityIds();
  const topic = store.analysis.topic;
  const model = useAIStore.getState().model;
  const provider = resolveProvider(model);
  let result: AnalysisResult = {
    status: "aborted",
    phasesCompleted: 0,
    totalEntities: getTotalEntityCount(),
    runId: run.runId,
  };

  run.logger.log("orchestrator", "analysis-start", {
    mode: "revalidation",
    topic: topic.slice(0, 80),
    model,
    provider: provider ?? "unknown",
  });

  try {
    if (staleIds.length === 0) {
      result = {
        status: "success",
        phasesCompleted: 0,
        totalEntities: getTotalEntityCount(),
        runId: run.runId,
      };
      return result;
    }

    const staleEntities = store.analysis.entities.filter((e) => e.stale);
    const stalePhases = new Set(staleEntities.map((e) => e.phase));
    const earliestPhase = SUPPORTED_PHASES.find((p) => stalePhases.has(p));

    if (!earliestPhase) {
      store.clearStale(staleIds);
      result = {
        status: "success",
        phasesCompleted: 0,
        totalEntities: getTotalEntityCount(),
        runId: run.runId,
      };
      return result;
    }

    const startIndex = SUPPORTED_PHASES.indexOf(earliestPhase);
    const phasesToRerun = SUPPORTED_PHASES.slice(startIndex);
    const priorPhases = SUPPORTED_PHASES.slice(0, startIndex);

    for (const phase of phasesToRerun) {
      if (signal.aborted) {
        result = {
          status: "aborted",
          phasesCompleted: priorPhases.length - startIndex,
          totalEntities: getTotalEntityCount(),
          runId: run.runId,
        };
        break;
      }

      const currentEntities = useEntityGraphStore.getState().analysis.entities;
      const oldPhaseEntities = currentEntities.filter((e) => e.phase === phase);
      for (const entity of oldPhaseEntities) {
        useEntityGraphStore.getState().removeEntity(entity.id);
      }

      const phaseResult = await runSinglePhase({
        phase,
        topic,
        priorPhases,
        model,
        provider,
        signal,
        callbacks,
        run,
      });

      if (phaseResult.status === "success") {
        priorPhases.push(phase);
        continue;
      }

      if (phaseResult.status === "failed") {
        result = {
          status: "failed",
          phasesCompleted: priorPhases.length - startIndex,
          totalEntities: getTotalEntityCount(),
          runId: run.runId,
          failedPhase: phase,
          failureKind: phaseResult.failureKind,
        };
        return result;
      }

      run.logger.warn("orchestrator", "analysis-aborted", {
        mode: "revalidation",
        phasesCompleted: priorPhases.length - startIndex,
      });
      result = {
        status: "aborted",
        phasesCompleted: priorPhases.length - startIndex,
        totalEntities: getTotalEntityCount(),
        runId: run.runId,
      };
      return result;
    }

    if (!signal.aborted) {
      useEntityGraphStore.getState().clearStale(staleIds);
      result = {
        status: "success",
        phasesCompleted: phasesToRerun.length,
        totalEntities: getTotalEntityCount(),
        runId: run.runId,
      };
    }

    return result;
  } finally {
    run.logger.log("orchestrator", "analysis-finished", {
      mode: "revalidation",
      status: result.status,
      phasesCompleted: result.phasesCompleted,
      totalEntities: result.totalEntities,
      failedPhase: result.failedPhase,
      failureKind: result.failureKind,
      elapsedMs: analysisTimer.elapsed(),
    });
    await run.logger.flush();
  }
}
