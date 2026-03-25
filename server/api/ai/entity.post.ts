import { defineEventHandler, readBody, setResponseStatus } from "h3";
import type { H3Event } from "h3";
import { z } from "zod";
import * as entityGraphService from "../../services/entity-graph-service";
import * as analysisOrchestrator from "../../agents/analysis-agent";
import { startCommand, submitCommand } from "../../services/command-handlers";
import type {
  CommandReceipt,
  SubmitCommand,
  CommandMetadataInput,
} from "../../services/command-bus";
import { serverError } from "../../utils/ai-logger";

const baseActionSchema = z.object({
  action: z.string().min(1),
});

const commandMetadataSchema = z
  .object({
    commandId: z.string().optional(),
    receiptId: z.string().optional(),
    correlationId: z.string().optional(),
    causationId: z.string().optional(),
    runId: z.string().optional(),
    workspaceId: z.string().optional(),
    threadId: z.string().optional(),
    requestedBy: z.string().optional(),
    submittedAt: z.number().optional(),
  })
  .optional();

const updateActionSchema = z.object({
  action: z.literal("update"),
  id: z.string().min(1),
  updates: z.record(z.string(), z.unknown()),
  command: commandMetadataSchema,
});

const newAnalysisActionSchema = z.object({
  action: z.literal("newAnalysis"),
  topic: z.string().optional(),
  command: commandMetadataSchema,
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
    const started = await startCommand(createMutationCommand(body), {
      schedule: (run) => {
        analysisOrchestrator.queueEdit(() => {
          run();
        });
      },
    });
    void started.completion.catch((error) => {
      serverError(
        body.command?.runId,
        "entity-route",
        "queued-command-failed",
        {
          action: body.action,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    });
    return mapMutationReceipt(body.action, started.receipt, event, {
      queued: true,
    });
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

function buildCommandMetadata(
  command: CommandMetadataInput | undefined,
  requestedBy: string,
): CommandMetadataInput {
  return {
    requestedBy,
    ...(command ?? {}),
  };
}

function createMutationCommand(
  body: Exclude<EntityActionBody, { action: "get" }>,
): SubmitCommand {
  switch (body.action) {
    case "update":
      return {
        kind: "entity.update",
        id: body.id,
        updates: body.updates,
        provenanceSource: "user-edited",
        ...buildCommandMetadata(body.command, "api:ai-entity.update"),
      };
    case "newAnalysis":
      return {
        kind: "analysis.reset",
        topic: body.topic || "",
        ...buildCommandMetadata(body.command, "api:ai-entity.reset"),
      };
  }
}

function hasPendingReceipt(receipt: CommandReceipt): boolean {
  return (
    receipt.result === undefined &&
    !receipt.error &&
    (receipt.status === "accepted" ||
      receipt.status === "running" ||
      receipt.status === "deduplicated")
  );
}

function mapMutationReceipt(
  action: Exclude<EntityActionBody, { action: "get" }>["action"],
  receipt: CommandReceipt,
  event?: H3Event,
  options: { queued?: boolean } = {},
) {
  if (receipt.status === "conflicted") {
    if (event) setResponseStatus(event, 409);
    return { error: receipt.error?.message ?? "Command receipt conflict" };
  }

  if (receipt.status === "failed") {
    if (action === "update") {
      if (event) setResponseStatus(event, 404);
      return { error: receipt.error?.message ?? "Entity not found" };
    }
    throw new Error(receipt.error?.message ?? "Failed to reset analysis");
  }

  if (options.queued && hasPendingReceipt(receipt)) {
    if (event) setResponseStatus(event, 202);
    return {
      queued: true,
      status: receipt.status,
      commandId: receipt.commandId,
      ...(receipt.receiptId ? { receiptId: receipt.receiptId } : {}),
    };
  }

  switch (action) {
    case "update": {
      const result = receipt.result as {
        updated: unknown[];
        staleMarked: string[];
      };
      return {
        updated: result.updated[0],
        staleMarked: result.staleMarked,
      };
    }
    case "newAnalysis": {
      const result = receipt.result as { analysis: Readonly<unknown> };
      return { analysis: result.analysis };
    }
  }
}

async function executeMutationCommand(
  body: Exclude<EntityActionBody, { action: "get" }>,
  event?: H3Event,
) {
  const receipt = await submitCommand(createMutationCommand(body));
  return mapMutationReceipt(body.action, receipt, event);
}

async function executeAction(body: EntityActionBody, event?: H3Event) {
  switch (body.action) {
    case "get":
      return { analysis: entityGraphService.getAnalysis() };
    case "update":
    case "newAnalysis":
      return executeMutationCommand(body, event);
  }
}
