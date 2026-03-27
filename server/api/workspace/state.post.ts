import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { z } from "zod";
import * as entityGraphService from "../../services/entity-graph-service";
import {
  createCanonicalWorkspaceRecord,
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
  import: z.boolean().optional(),
});

function extractNonEntityFields(snapshot: unknown): {
  layout?: unknown;
  threads?: unknown[];
  artifacts?: unknown[];
  checkpointHeaders?: unknown[];
  pendingQuestions?: unknown[];
} {
  if (!snapshot || typeof snapshot !== "object") return {};
  const s = snapshot as Record<string, unknown>;
  return {
    layout: s.layout ?? {},
    threads: Array.isArray(s.threads) ? s.threads : [],
    artifacts: Array.isArray(s.artifacts) ? s.artifacts : [],
    checkpointHeaders: Array.isArray(s.checkpointHeaders)
      ? s.checkpointHeaders
      : [],
    pendingQuestions: Array.isArray(s.pendingQuestions)
      ? s.pendingQuestions
      : [],
  };
}

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

  const { workspace: ws, snapshot, filePath } = parsed.data;
  const isImport = parsed.data.import === true;
  const nonEntityFields = extractNonEntityFields(snapshot);

  // Import mode: load entities from snapshot into graph tables first
  if (isImport) {
    const snap = snapshot as Record<string, unknown> | null;
    const analysis = snap?.analysis as Record<string, unknown> | undefined;
    if (analysis && typeof analysis === "object") {
      entityGraphService.loadAnalysis(analysis as never, {
        workspaceId: ws.id,
      });
    }
  }

  // Entity data lives exclusively in graph_entities / graph_relationships
  // tables. workspace_json stores only non-entity metadata (layout, threads, etc.).
  const record = getWorkspaceDatabase().workspaces.upsertWorkspace(
    createCanonicalWorkspaceRecord({
      id: ws.id,
      name: ws.name,
      analysisType: ws.analysisType,
      filePath: filePath ?? null,
      nonEntityFields,
      createdAt: ws.createdAt,
      updatedAt: ws.updatedAt,
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
