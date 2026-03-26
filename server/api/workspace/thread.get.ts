import { defineEventHandler, getQuery, setResponseStatus } from "h3";
import { z } from "zod";
import {
  createThreadService,
  getWorkspaceDatabase,
} from "../../services/workspace";

const threadQuerySchema = z.object({
  threadId: z.string().trim().min(1),
  workspaceId: z.string().trim().min(1).optional(),
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

  if (
    parsed.data.workspaceId &&
    detail.workspaceId !== parsed.data.workspaceId
  ) {
    setResponseStatus(event, 403);
    return { error: "Thread does not belong to the requested workspace" };
  }

  return detail;
});
