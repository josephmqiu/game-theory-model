import { defineEventHandler, readBody, setResponseStatus } from "h3";
import type { H3Event } from "h3";
import { z } from "zod";
import * as entityGraphService from "../../services/entity-graph-service";
import * as analysisOrchestrator from "../../agents/analysis-agent";
import { validateEntityUpdates } from "../../services/entity-update-validation";
import { latestLogNo } from "../../services/revision-log";
import { endAllSessions } from "../../services/ai/chat-sessions";

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

// Objection bounds mirror the challenge form spec (2.1A): submit is disabled
// under 10 characters and the textarea counts down from 2000.
const challengeActionSchema = z.object({
  action: z.literal("challenge"),
  id: z.string().min(1),
  objection: z.string().min(10).max(2000),
});

const challengeViewedActionSchema = z.object({
  action: z.literal("challengeViewed"),
  id: z.string().min(1),
});

const downstreamActionSchema = z.object({
  action: z.literal("downstream"),
  id: z.string().min(1),
});

type EntityActionBody =
  | z.infer<typeof updateActionSchema>
  | z.infer<typeof newAnalysisActionSchema>
  | z.infer<typeof getActionSchema>
  | z.infer<typeof challengeActionSchema>
  | z.infer<typeof challengeViewedActionSchema>
  | z.infer<typeof downstreamActionSchema>;

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

  // Challenges also verify the target before queueing/applying.
  if (body.action === "challenge" || body.action === "challengeViewed") {
    const missing =
      body.action === "challenge"
        ? entityGraphService.getEntityById(body.id) === null
        : entityGraphService
            .getChallenges()
            .every((challenge) => challenge.id !== body.id);
    if (missing) {
      setResponseStatus(event, 404);
      return {
        error:
          body.action === "challenge"
            ? "Entity not found"
            : "Challenge not found",
      };
    }
  }

  const isReadAction = body.action === "get" || body.action === "downstream";
  const isQueueableMutation =
    body.action === "update" || body.action === "challenge";

  // If analysis running, queue graph mutations. For updates, capture the
  // latest logNo the editor could have seen NOW — when the queued edit
  // drains after the in-flight phase, a newer log entry means the edit was
  // made against stale content and gets conflict-marked (E4A).
  if (
    analysisOrchestrator.isRunning() &&
    !isReadAction &&
    (isQueueableMutation || body.action === "newAnalysis")
  ) {
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
    case "challenge": {
      const parsed = challengeActionSchema.safeParse(body);
      if (!parsed.success) {
        return {
          success: false,
          error:
            "Invalid challenge request: expected id and an objection of 10–2000 characters",
        };
      }
      return { success: true, data: parsed.data };
    }
    case "challengeViewed": {
      const parsed = challengeViewedActionSchema.safeParse(body);
      if (!parsed.success) {
        return { success: false, error: "Invalid challengeViewed request" };
      }
      return { success: true, data: parsed.data };
    }
    case "downstream": {
      const parsed = downstreamActionSchema.safeParse(body);
      if (!parsed.success) {
        return { success: false, error: "Invalid downstream request" };
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
      endAllSessions();
      entityGraphService.newAnalysis(body.topic || "");
      return { analysis: entityGraphService.getAnalysis() };
    case "challenge": {
      const result = entityGraphService.createChallenge(
        body.id,
        body.objection,
      );
      if (result === null) {
        if (event) setResponseStatus(event, 404);
        return { error: "Entity not found" };
      }
      return {
        challenge: result.challenge,
        staleMarked: result.staleMarked,
        // Preview count shown in the challenge form (2.1A): dependents only,
        // excluding the challenged entity itself.
        downstreamCount: result.staleMarked.length - 1,
      };
    }
    case "challengeViewed": {
      const viewed = entityGraphService.markChallengeViewed(body.id);
      if (viewed === null) {
        if (event) setResponseStatus(event, 404);
        return { error: "Challenge not found" };
      }
      return { challenge: viewed };
    }
    case "downstream": {
      const entity = entityGraphService.getEntityById(body.id);
      if (entity === null) {
        if (event) setResponseStatus(event, 404);
        return { error: "Entity not found" };
      }
      return {
        downstreamIds: entityGraphService.getDownstreamEntityIds(body.id),
      };
    }
  }
}
