import { defineEventHandler, readBody, setResponseStatus } from "h3";
import type { H3Event } from "h3";
import { z } from "zod";
import * as entityGraphService from "../../services/entity-graph-service";
import * as analysisOrchestrator from "../../agents/analysis-agent";
import { validateEntityUpdates } from "../../services/entity-update-validation";
import { latestLogNo } from "../../services/revision-log";

const baseActionSchema = z.object({
  action: z.string().min(1),
});

const updateActionSchema = z.object({
  action: z.literal("update"),
  id: z.string().min(1),
  updates: z.record(z.string(), z.unknown()),
});

const newAnalysisActionSchema = z.object({
  action: z.literal("newAnalysis"),
  topic: z.string().optional(),
});

const getActionSchema = z.object({
  action: z.literal("get"),
});

type EntityActionBody =
  | z.infer<typeof updateActionSchema>
  | z.infer<typeof newAnalysisActionSchema>
  | z.infer<typeof getActionSchema>;

export default defineEventHandler(async (event) => {
  let rawBody: unknown;
  try {
    rawBody = await readBody(event);
  } catch {
    setResponseStatus(event, 400);
    return { error: "Invalid request body" };
  }

  const baseParse = baseActionSchema.safeParse(rawBody);
  if (!baseParse.success) {
    setResponseStatus(event, 400);
    return { error: "Missing action" };
  }

  const parsedBody = parseEntityAction(rawBody, baseParse.data.action);
  if (!parsedBody.success) {
    setResponseStatus(event, 400);
    return { error: parsedBody.error };
  }
  const body = parsedBody.data;

  // Updates are validated against the target's per-type schema BEFORE they
  // are applied or queued (8A) — an invalid edit must never enter the queue.
  if (body.action === "update") {
    const existing = entityGraphService.getEntityById(body.id);
    if (!existing) {
      setResponseStatus(event, 404);
      return { error: "Entity not found" };
    }

    const validation = validateEntityUpdates(existing, body.updates);
    if (!validation.ok) {
      setResponseStatus(event, 400);
      return {
        error: "Validation failed",
        fieldErrors: validation.fieldErrors,
      };
    }

    body.updates = validation.updates as Record<string, unknown>;
  }

  // If analysis running and this is a mutation, queue it. For updates,
  // capture the latest logNo the editor could have seen NOW — when the
  // queued edit drains after the in-flight phase, a newer log entry means
  // the edit was made against stale content and gets conflict-marked (E4A).
  if (analysisOrchestrator.isRunning() && body.action !== "get") {
    const baseLogNo =
      body.action === "update"
        ? latestLogNo(entityGraphService.getEntityById(body.id)?.revisionLog)
        : undefined;
    analysisOrchestrator.queueEdit(() => executeAction(body, { baseLogNo }));
    return { queued: true };
  }

  return executeAction(body, undefined, event);
});

function parseEntityAction(
  body: unknown,
  action: string,
):
  | { success: true; data: EntityActionBody }
  | { success: false; error: string } {
  switch (action) {
    case "update": {
      const parsed = updateActionSchema.safeParse(body);
      if (!parsed.success) {
        return {
          success: false,
          error: "Invalid update request: expected id and updates object",
        };
      }
      return { success: true, data: parsed.data };
    }
    case "get": {
      const parsed = getActionSchema.safeParse(body);
      if (!parsed.success) {
        return { success: false, error: "Invalid get request" };
      }
      return { success: true, data: parsed.data };
    }
    case "newAnalysis": {
      const parsed = newAnalysisActionSchema.safeParse(body);
      if (!parsed.success) {
        return { success: false, error: "Invalid newAnalysis request" };
      }
      return { success: true, data: parsed.data };
    }
    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}

function executeAction(
  body: EntityActionBody,
  queueContext?: { baseLogNo?: number },
  event?: H3Event,
) {
  switch (body.action) {
    case "update": {
      const updated = entityGraphService.updateEntity(body.id, body.updates, {
        source: "user-edited",
        logSource: "human",
        baseLogNo: queueContext?.baseLogNo,
      });
      if (updated === null) {
        if (event) setResponseStatus(event, 404);
        return { error: "Entity not found" };
      }
      return { updated, staleMarked: entityGraphService.getStaleEntityIds() };
    }
    case "get":
      return { analysis: entityGraphService.getAnalysis() };
    case "newAnalysis":
      entityGraphService.newAnalysis(body.topic || "");
      return { analysis: entityGraphService.getAnalysis() };
  }
}
