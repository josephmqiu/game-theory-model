import { defineEventHandler, readBody, setResponseStatus } from "h3";
import type { AnalysisRuntimeOverrides } from "../../../shared/types/analysis-runtime";
import * as analysisOrchestrator from "../../agents/analysis-agent";
import { normalizeRequestedActivePhases } from "../../services/analysis-phase-selection";

interface AnalyzeBody {
  topic: string;
  provider?: string;
  model?: string;
  runtime?: AnalysisRuntimeOverrides;
}

function isActiveRunError(error: unknown): boolean {
  return error instanceof Error && error.message === "A run is already active";
}

export default defineEventHandler(async (event) => {
  const body = ((await readBody<AnalyzeBody | undefined>(event)) ??
    {}) as AnalyzeBody;
  const topic = body.topic?.trim();

  if (!topic) {
    setResponseStatus(event, 400);
    return { error: "Missing required field: topic" };
  }

  try {
    normalizeRequestedActivePhases(body.runtime?.activePhases);
  } catch (error) {
    setResponseStatus(event, 400);
    return {
      error:
        error instanceof Error ? error.message : "Invalid runtime.activePhases",
    };
  }

  try {
    const { runId } = await analysisOrchestrator.runFull(
      topic,
      body.provider,
      body.model,
      undefined,
      body.runtime,
    );
    setResponseStatus(event, 202);
    return { runId };
  } catch (error) {
    if (isActiveRunError(error)) {
      setResponseStatus(event, 409);
      return { error: "Analysis already running" };
    }

    throw error;
  }
});
