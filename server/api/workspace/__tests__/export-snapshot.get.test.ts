import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getWorkspaceDatabase,
  resetWorkspaceDatabaseForTest,
} from "../../../services/workspace";
import { createWorkspaceRecordFromSnapshot } from "../../../services/workspace";

const setResponseStatusMock = vi.fn();

vi.mock("h3", () => ({
  defineEventHandler: (handler: unknown) => handler,
  setResponseStatus: (...args: unknown[]) => setResponseStatusMock(...args),
}));

const getWorkspaceIdMock = vi.fn(() => null as string | null);
const getAnalysisMock = vi.fn(() => ({
  id: "analysis-1",
  name: "Test Analysis",
  topic: "test topic",
  entities: [
    {
      id: "e1",
      type: "fact",
      phase: "situational-grounding",
      data: { type: "fact", content: "canonical", category: "action" },
      confidence: "high",
      source: "ai",
      rationale: "test",
      revision: 1,
      stale: false,
    },
  ],
  relationships: [],
  phases: [],
}));

vi.mock("../../../services/entity-graph-service", () => ({
  getWorkspaceId: () => getWorkspaceIdMock(),
  getAnalysis: () => getAnalysisMock(),
}));

describe("GET /api/workspace/export-snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkspaceDatabaseForTest();
    getWorkspaceIdMock.mockReturnValue(null);
  });

  it("returns 404 when no active workspace", async () => {
    getWorkspaceIdMock.mockReturnValue(null);

    const route = (await import("../export-snapshot.get")).default;
    const result = await route({} as never);

    expect(result).toEqual({ error: "No active workspace" });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 404);
  });

  it("returns canonical entities from entity-graph-service", async () => {
    getWorkspaceIdMock.mockReturnValue("ws-1");

    // Store a workspace record with different entities in workspace_json
    getWorkspaceDatabase().workspaces.upsertWorkspace(
      createWorkspaceRecordFromSnapshot({
        id: "ws-1",
        name: "Test Workspace",
        analysisType: "game-theory",
        snapshot: {
          id: "ws-1",
          name: "Test Workspace",
          analysisType: "game-theory",
          createdAt: 100,
          updatedAt: 200,
          analysis: {
            id: "stale-analysis",
            name: "Stale",
            topic: "stale",
            entities: [],
            relationships: [],
            phases: [],
          },
          layout: { e1: { x: 50, y: 75, pinned: true } },
          threads: [{ id: "t1" }],
          artifacts: [],
          checkpointHeaders: [],
          pendingQuestions: [],
        },
        createdAt: 100,
        updatedAt: 200,
      }),
    );

    const route = (await import("../export-snapshot.get")).default;
    const result = (await route({} as never)) as Record<string, unknown>;

    // Entities come from canonical source (mock), not workspace_json
    const analysis = result.analysis as Record<string, unknown>;
    expect(analysis.id).toBe("analysis-1");
    expect((analysis.entities as unknown[]).length).toBe(1);

    // Non-entity data comes from workspace_json
    expect(result.layout).toEqual({ e1: { x: 50, y: 75, pinned: true } });
    expect(result.threads).toEqual([{ id: "t1" }]);
  });
});
