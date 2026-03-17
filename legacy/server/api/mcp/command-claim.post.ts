import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { z } from "zod";
import { claimCommand } from "../../utils/mcp-command-bus";

const claimSchema = z.object({
  id: z.string().min(1),
  ownerClientId: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const raw = await readBody(event);
  const parsed = claimSchema.safeParse(raw);

  if (!parsed.success) {
    setResponseStatus(event, 400);
    return {
      status: "error",
      error: "Invalid command claim payload",
    };
  }

  const result = claimCommand(parsed.data);
  if (result.status === "missing") {
    setResponseStatus(event, 404);
    return {
      status: "missing",
      error: "Command not found or already completed.",
    };
  }

  if (result.status === "busy") {
    setResponseStatus(event, 409);
    return {
      status: "busy",
      command: result.command,
      error: "Command is already claimed by another renderer.",
    };
  }

  return {
    status: "claimed",
    command: result.command,
  };
});
