import { defineEventHandler, readBody, setResponseStatus } from "h3";
import type { H3Event } from "h3";
import { z } from "zod";
import * as entityGraphService from "../../services/entity-graph-service";
import * as analysisOrchestrator from "../../agents/analysis-agent";

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

  // If analysis running and this is a mutation, queue it
  if (analysisOrchestrator.isRunning() && body.action !== "get") {
    analysisOrchestrator.queueEdit(() => executeAction(body));
    return { queued: true };
  }

  return executeAction(body, event);
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

function executeAction(body: EntityActionBody, event?: H3Event) {
  switch (body.action) {
    case "update": {
      const updated = entityGraphService.updateEntity(body.id, body.updates, {
        source: "user-edited",
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
