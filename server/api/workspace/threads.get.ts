import { defineEventHandler, getQuery, setResponseStatus } from "h3";
import { z } from "zod";
import { createThreadService, getWorkspaceDatabase } from "../../services/workspace";
import { resolveWorkspaceId } from "../../services/workspace/workspace-context";

const threadsQuerySchema = z.object({
  workspaceId: z.string().trim().min(1),
});

export default defineEventHandler((event) => {
  const parsed = threadsQuerySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    setResponseStatus(event, 400);
    return { error: "Invalid workspace query" };
  }

  const database = getWorkspaceDatabase();
  const workspaceId = resolveWorkspaceId(
    database.workspaces,
    parsed.data.workspaceId,
  );
  const threadService = createThreadService(database);

  return {
    workspaceId,
    threads: threadService.listThreadsByWorkspaceId(workspaceId),
  };
});
