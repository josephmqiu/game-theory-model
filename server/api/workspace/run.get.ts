import { defineEventHandler, getQuery, setResponseStatus } from "h3";
import { z } from "zod";
import { createRunService, getWorkspaceDatabase } from "../../services/workspace";

const runQuerySchema = z.object({
  runId: z.string().trim().min(1),
  workspaceId: z.string().trim().min(1).optional(),
});

export default defineEventHandler((event) => {
  const parsed = runQuerySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    setResponseStatus(event, 400);
    return { error: "Invalid run query" };
  }

  const runService = createRunService(getWorkspaceDatabase());
  const detail = runService.getRunDetailById(parsed.data.runId);

  if (!detail) {
    setResponseStatus(event, 404);
    return { error: "Run not found" };
  }

  if (
    parsed.data.workspaceId &&
    detail.run.workspaceId !== parsed.data.workspaceId
  ) {
    setResponseStatus(event, 403);
    return { error: "Run does not belong to the requested workspace" };
  }

  return detail;
});
