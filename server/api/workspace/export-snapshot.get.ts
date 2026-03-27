import { defineEventHandler, setResponseStatus } from "h3";
import * as entityGraphService from "../../services/entity-graph-service";
import { getWorkspaceDatabase } from "../../services/workspace";

/**
 * Returns a Workspace-shaped JSON with entity data from the canonical graph
 * tables. Non-entity fields (layout, threads, etc.) come from workspace_json.
 * Used by the renderer for .gta export to ensure exported entities match the
 * server's canonical source of truth.
 */
export default defineEventHandler(async (event) => {
  const workspaceId = entityGraphService.getWorkspaceId();
  if (!workspaceId) {
    setResponseStatus(event, 404);
    return { error: "No active workspace" };
  }

  const record = getWorkspaceDatabase().workspaces.getWorkspace(workspaceId);
  let stored: Record<string, unknown> = {};
  if (record?.workspaceJson) {
    try {
      stored = JSON.parse(record.workspaceJson) as Record<string, unknown>;
    } catch {
      // corrupt workspace_json — proceed with defaults
    }
  }

  const analysis = entityGraphService.getAnalysis();

  return {
    id: stored.id ?? workspaceId,
    name: stored.name ?? analysis.name,
    analysisType: "game-theory",
    createdAt:
      typeof stored.createdAt === "number"
        ? stored.createdAt
        : (record?.createdAt ?? Date.now()),
    updatedAt: Date.now(),
    analysis,
    layout: stored.layout ?? {},
    threads: Array.isArray(stored.threads) ? stored.threads : [],
    artifacts: Array.isArray(stored.artifacts) ? stored.artifacts : [],
    checkpointHeaders: Array.isArray(stored.checkpointHeaders)
      ? stored.checkpointHeaders
      : [],
    pendingQuestions: Array.isArray(stored.pendingQuestions)
      ? stored.pendingQuestions
      : [],
  };
});
