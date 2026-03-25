import { defineEventHandler, readBody, setResponseStatus } from "h3";
import type { AnalysisRuntimeOverrides } from "../../../shared/types/analysis-runtime";
import { normalizeRequestedActivePhases } from "../../services/analysis-phase-selection";
import {
  submitCommand,
  type CommandMetadataInput,
} from "../../services/command-bus";

interface AnalyzeBody {
  topic: string;
  provider?: string;
  model?: string;
  runtime?: AnalysisRuntimeOverrides;
  command?: CommandMetadataInput;
}

function isActiveRunError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message === "A run is already active";
  }
  return error === "A run is already active";
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
    const receipt = await submitCommand({
      kind: "analysis.start",
      topic,
      provider: body.provider,
      model: body.model,
      runtime: body.runtime,
      requestedBy: "api:ai-analyze",
      ...(body.command ?? {}),
    });

    if (receipt.status === "conflicted") {
      setResponseStatus(event, 409);
      return {
        error: receipt.error?.message ?? "Command receipt conflict",
      };
    }

    if (receipt.status === "failed") {
      if (isActiveRunError(receipt.error?.message)) {
        setResponseStatus(event, 409);
        return { error: "Analysis already running" };
      }
      throw new Error(receipt.error?.message ?? "Failed to start analysis");
    }

    const result = receipt.result as { runId: string };
    setResponseStatus(event, 202);
    return { runId: result.runId };
  } catch (error) {
    if (isActiveRunError(error)) {
      setResponseStatus(event, 409);
      return { error: "Analysis already running" };
    }

    throw error;
  }
});
