import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { z } from "zod";
import { createThreadService, getWorkspaceDatabase } from "../../services/workspace";

const threadCreateBodySchema = z.object({
  workspaceId: z.string().trim().min(1),
  title: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  let rawBody: unknown;
  try {
    rawBody = await readBody(event);
  } catch {
    setResponseStatus(event, 400);
    return { error: "Invalid request body" };
  }

  const parsed = threadCreateBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    setResponseStatus(event, 400);
    return { error: "Invalid thread create payload" };
  }

  const threadService = createThreadService(getWorkspaceDatabase());
  const thread = threadService.createThread({
    workspaceId: parsed.data.workspaceId,
    title: parsed.data.title?.trim() || undefined,
    producer: "workspace-thread-api",
  });

  return {
    workspaceId: thread.workspaceId,
    thread,
  };
});
