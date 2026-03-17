import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { z } from "zod";
import { completeCommand, getCommand } from "../../utils/mcp-command-bus";

const resultSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["completed", "failed"]),
  result: z.unknown().optional(),
  error: z.string().nullable().optional(),
  sourceClientId: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  const raw = await readBody(event);
  const parsed = resultSchema.safeParse(raw);

  if (!parsed.success) {
    setResponseStatus(event, 400);
    return {
      status: "error",
      error: "Invalid command result payload",
    };
  }

  const command = completeCommand(parsed.data);
  if (!command) {
    const existing = getCommand(parsed.data.id);
    setResponseStatus(event, existing ? 409 : 404);
    return {
      status: "error",
      error: existing
        ? "Command is owned by a different renderer."
        : "Command not found",
    };
  }

  return { status: "ok", command };
});
