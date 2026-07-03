import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { z } from "zod";
import { endSession } from "../../services/ai/chat-sessions";

const chatSessionDeleteSchema = z.object({
  key: z.string().trim().min(1),
});

export default defineEventHandler(async (event) => {
  let rawBody: unknown;
  try {
    rawBody = await readBody(event);
  } catch {
    setResponseStatus(event, 400);
    return { error: "Invalid request body" };
  }

  const parsed = chatSessionDeleteSchema.safeParse(rawBody);
  if (!parsed.success) {
    setResponseStatus(event, 400);
    return { error: "Invalid chat session delete request" };
  }

  return { ended: endSession(parsed.data.key) };
});
