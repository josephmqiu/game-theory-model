import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { z } from "zod";
import { enqueueCommand, waitForCommandResult } from "../../utils/mcp-command-bus";

const runPhaseSchema = z.object({
  phase: z.number().int().min(1).max(10),
  input: z.record(z.unknown()).optional(),
});

interface PhaseResult {
  success: boolean;
  phase: number;
  summary: string;
  error?: string;
  result?: unknown;
}

/**
 * POST endpoint to execute a single analysis phase.
 * Accepts { phase: number, input?: object } and returns a phase execution result.
 *
 * Phase execution is delegated to the pipeline orchestrator (when wired).
 * This endpoint acts as the HTTP bridge for the MCP phase tools.
 */
export default defineEventHandler(async (event): Promise<PhaseResult> => {
  const raw = await readBody(event);

  const parsed = runPhaseSchema.safeParse(raw);
  if (!parsed.success) {
    setResponseStatus(event, 400);
    return {
      success: false,
      phase: raw?.phase ?? 0,
      summary: "Invalid request body",
      error: parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
    };
  }

  const { phase, input } = parsed.data;

  try {
    const command = enqueueCommand({
      type: "run_phase",
      payload: { phase, input },
      sourceClientId: "api:run-phase",
    });

    const outcome = await waitForCommandResult(command.id, 30_000);
    if (!outcome) {
      setResponseStatus(event, 504);
      return {
        success: false,
        phase,
        summary: `Phase ${phase} timed out waiting for renderer execution`,
        error: "No renderer acknowledged the queued command within 30 seconds.",
      };
    }

    if (outcome.status === "failed") {
      setResponseStatus(event, 500);
      return {
        success: false,
        phase,
        summary: `Phase ${phase} failed`,
        error: outcome.error ?? "Renderer phase execution failed",
      };
    }

    return {
      success: true,
      phase,
      summary: `Phase ${phase} complete.`,
      result: outcome.result,
    };
  } catch (error) {
    setResponseStatus(event, 500);
    return {
      success: false,
      phase,
      summary: `Phase ${phase} failed`,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});
