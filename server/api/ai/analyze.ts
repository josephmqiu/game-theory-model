import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { z } from "zod";
import type { AnalysisRuntimeOverrides } from "../../../shared/types/analysis-runtime";
import * as analysisOrchestrator from "../../agents/analysis-agent";
import { normalizeRequestedActivePhases } from "../../services/analysis-phase-selection";

const customProviderSchema = z.object({
  baseURL: z.string().url(),
  apiKey: z.string(),
  hasNativeWebSearch: z.boolean().optional().default(false),
});

interface AnalyzeBody {
  topic: string;
  provider?: string;
  model?: string;
  runtime?: AnalysisRuntimeOverrides;
  custom?: z.input<typeof customProviderSchema>;
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

  // The custom provider must arrive with its BYOK connection details (the
  // server never caches them).
  let customCredentials: z.output<typeof customProviderSchema> | undefined;
  if (body.provider === "custom") {
    const parsedCustom = customProviderSchema.safeParse(body.custom);
    if (!parsedCustom.success) {
      setResponseStatus(event, 400);
      return { error: "Custom provider requires baseURL and apiKey" };
    }
    customCredentials = parsedCustom.data;
  }

  try {
    const { runId } = await analysisOrchestrator.runFull(
      topic,
      body.provider,
      body.model,
      undefined,
      body.runtime,
      customCredentials,
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
