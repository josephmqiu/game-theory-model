import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { z } from "zod";
import {
  enqueueCommand,
  waitForCommandResult,
} from "../../utils/mcp-command-bus";

const envelopeFields = {
  sourceClientId: z.string().optional(),
  waitForResult: z.boolean().optional(),
  timeoutMs: z.number().int().positive().max(120_000).optional(),
};

const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("start_analysis"),
    payload: z.object({
      description: z.string().min(1),
      manual: z.boolean().optional(),
    }),
    ...envelopeFields,
  }),
  z.object({
    type: z.literal("send_chat"),
    payload: z.object({
      system: z.string(),
      provider: z.enum(["anthropic", "openai", "opencode", "copilot"]),
      model: z.string().min(1),
      messages: z.array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        }),
      ),
    }),
    ...envelopeFields,
  }),
  z.object({
    type: z.literal("run_phase"),
    payload: z.object({
      phase: z.number().int().min(1).max(10),
      input: z.unknown().optional(),
    }),
    ...envelopeFields,
  }),
  z.object({
    type: z.literal("run_next_phase"),
    payload: z.object({}).strict(),
    ...envelopeFields,
  }),
  z.object({
    type: z.literal("approve_revalidation"),
    payload: z.object({ eventId: z.string().min(1) }),
    ...envelopeFields,
  }),
  z.object({
    type: z.literal("dismiss_revalidation"),
    payload: z.object({ eventId: z.string().min(1) }),
    ...envelopeFields,
  }),
  z.object({
    type: z.literal("apply_proposal"),
    payload: z.object({ proposalId: z.string().min(1) }),
    ...envelopeFields,
  }),
  z.object({
    type: z.literal("register_proposal_group"),
    payload: z.object({
      phase: z.number().int().min(1).max(10),
      content: z.string().min(1),
      messageType: z.enum(["proposal", "result", "finding"]).optional(),
      proposals: z.array(z.unknown()),
    }),
    ...envelopeFields,
  }),
  z.object({
    type: z.literal("start_play_session"),
    payload: z.object({
      scenarioId: z.string().min(1),
      aiControlledPlayers: z.array(z.string()).optional(),
    }),
    ...envelopeFields,
  }),
  z.object({
    type: z.literal("branch_play_session"),
    payload: z.object({
      sessionId: z.string().min(1),
      branchLabel: z.string().min(1),
    }),
    ...envelopeFields,
  }),
  z.object({
    type: z.literal("play_turn"),
    payload: z.object({
      sessionId: z.string().min(1),
      playerId: z.string().min(1),
      action: z.string().min(1),
      reasoning: z.string().optional(),
    }),
    ...envelopeFields,
  }),
]);

export default defineEventHandler(async (event) => {
  const raw = await readBody(event);
  const parsed = commandSchema.safeParse(raw);

  if (!parsed.success) {
    setResponseStatus(event, 400);
    return {
      status: "error",
      error: "Invalid command payload",
    };
  }

  const command = enqueueCommand({
    type: parsed.data.type,
    payload: parsed.data.payload as never,
    sourceClientId: parsed.data.sourceClientId,
  });

  if (!parsed.data.waitForResult) {
    return { status: "queued", command };
  }

  const result = await waitForCommandResult(
    command.id,
    parsed.data.timeoutMs ?? 30_000,
  );

  if (!result) {
    setResponseStatus(event, 504);
    return {
      status: "timeout",
      command,
      error: "Timed out waiting for renderer command execution.",
    };
  }

  if (result.status === "failed") {
    setResponseStatus(event, 500);
  }

  return {
    status: result.status,
    command: result,
  };
});
