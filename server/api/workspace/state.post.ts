import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { z } from "zod";
import {
  createWorkspaceRecordFromSnapshot,
  getWorkspaceDatabase,
} from "../../services/workspace";

const workspaceSyncBodySchema = z.object({
  workspace: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    analysisType: z.literal("game-theory"),
    createdAt: z.number(),
    updatedAt: z.number(),
  }),
  snapshot: z.unknown(),
  fileName: z.string().nullable().optional(),
  filePath: z.string().nullable().optional(),
});

export default defineEventHandler(async (event) => {
  let rawBody: unknown;
  try {
    rawBody = await readBody(event);
  } catch {
    setResponseStatus(event, 400);
    return { error: "Invalid request body" };
  }

  const parsed = workspaceSyncBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    setResponseStatus(event, 400);
    return { error: "Invalid workspace sync payload" };
  }

  const record = getWorkspaceDatabase().workspaces.upsertWorkspace(
    createWorkspaceRecordFromSnapshot({
      id: parsed.data.workspace.id,
      name: parsed.data.workspace.name,
      analysisType: parsed.data.workspace.analysisType,
      filePath: parsed.data.filePath ?? null,
      snapshot: parsed.data.snapshot,
      createdAt: parsed.data.workspace.createdAt,
      updatedAt: parsed.data.workspace.updatedAt,
    }),
  );

  return {
    workspace: {
      id: record.id,
      name: record.name,
      analysisType: record.analysisType,
      filePath: record.filePath,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    },
  };
});
