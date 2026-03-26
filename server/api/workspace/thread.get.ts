import { defineEventHandler, getQuery, setResponseStatus } from "h3";
import { z } from "zod";
import { createThreadService, getWorkspaceDatabase } from "../../services/workspace";

const threadQuerySchema = z.object({
  threadId: z.string().trim().min(1),
});

export default defineEventHandler((event) => {
  const parsed = threadQuerySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    setResponseStatus(event, 400);
    return { error: "Invalid thread query" };
  }

  const threadService = createThreadService(getWorkspaceDatabase());
  const detail = threadService.getThreadDetailById(parsed.data.threadId);

  if (!detail) {
    setResponseStatus(event, 404);
    return { error: "Thread not found" };
  }

  return detail;
});
