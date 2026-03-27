import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getWorkspaceDatabase,
  resetWorkspaceDatabaseForTest,
} from "../../../services/workspace";

const readBodyMock = vi.fn();
const setResponseStatusMock = vi.fn();

vi.mock("h3", () => ({
  defineEventHandler: (handler: unknown) => handler,
  readBody: (...args: unknown[]) => readBodyMock(...args),
  setResponseStatus: (...args: unknown[]) => setResponseStatusMock(...args),
}));

const getWorkspaceIdMock = vi.fn(() => null as string | null);
const getAnalysisMock = vi.fn(() => ({
  id: "canonical-analysis",
  name: "Canonical Analysis",
  topic: "canonical topic",
  entities: [] as Record<string, unknown>[],
  relationships: [] as Record<string, unknown>[],
  phases: [] as Record<string, unknown>[],
}));
const loadAnalysisMock = vi.fn();

vi.mock("../../../services/entity-graph-service", () => ({
  getWorkspaceId: () => getWorkspaceIdMock(),
  getAnalysis: () => getAnalysisMock(),
  loadAnalysis: (...args: unknown[]) => loadAnalysisMock(...args),
}));

describe("/api/workspace/state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkspaceDatabaseForTest();
    getWorkspaceIdMock.mockReturnValue(null);
  });

  it("upserts the workspace snapshot into the local database", async () => {
    readBodyMock.mockResolvedValue({
      workspace: {
        id: "workspace-1",
        name: "Trade War Workspace",
        analysisType: "game-theory",
        createdAt: 100,
        updatedAt: 200,
      },
      snapshot: {
        id: "workspace-1",
        name: "Trade War Workspace",
        analysisType: "game-theory",
        createdAt: 100,
        updatedAt: 200,
        analysis: {
          id: "analysis-1",
          name: "Trade War Analysis",
          topic: "US-China trade tensions",
          entities: [],
          relationships: [],
          phases: [],
        },
        layout: {},
        threads: [],
        artifacts: [],
        checkpointHeaders: [],
        pendingQuestions: [],
      },
      filePath: "/tmp/trade-war.gta",
    });

    const route = (await import("../state.post")).default;
    const result = await route({} as never);

    expect(result).toEqual({
      workspace: {
        id: "workspace-1",
        name: "Trade War Workspace",
        analysisType: "game-theory",
        filePath: "/tmp/trade-war.gta",
        createdAt: 100,
        updatedAt: 200,
      },
    });

    const stored =
      getWorkspaceDatabase().workspaces.getWorkspace("workspace-1");
    expect(stored).toBeDefined();
    expect(stored?.filePath).toBe("/tmp/trade-war.gta");
    const json = JSON.parse(stored?.workspaceJson ?? "{}");
    expect(json).toMatchObject({
      id: "workspace-1",
      analysisType: "game-theory",
    });
    // Entity data must NOT be stored in workspace_json — it lives in graph tables
    expect(json.analysis).toBeUndefined();
  });

  it("derives entity data from canonical graph tables when service is initialized", async () => {
    // Service reports workspace-1 as active
    getWorkspaceIdMock.mockReturnValue("workspace-1");
    getAnalysisMock.mockReturnValue({
      id: "canonical-analysis",
      name: "Canonical Analysis",
      topic: "canonical topic",
      entities: [
        {
          id: "e1",
          type: "fact",
          phase: "situational-grounding",
          data: { type: "fact", content: "canonical fact", category: "action" },
          confidence: "high",
          source: "ai",
          rationale: "from graph tables",
          revision: 1,
          stale: false,
        },
      ],
      relationships: [],
      phases: [],
    });

    // Renderer sends snapshot with DIFFERENT entities
    readBodyMock.mockResolvedValue({
      workspace: {
        id: "workspace-1",
        name: "Trade War Workspace",
        analysisType: "game-theory",
        createdAt: 100,
        updatedAt: 200,
      },
      snapshot: {
        id: "workspace-1",
        name: "Trade War Workspace",
        analysisType: "game-theory",
        createdAt: 100,
        updatedAt: 200,
        analysis: {
          id: "stale-analysis",
          name: "Stale Analysis",
          topic: "stale topic",
          entities: [],
          relationships: [],
          phases: [],
        },
        layout: { e1: { x: 100, y: 200, pinned: true } },
        threads: [],
        artifacts: [],
        checkpointHeaders: [],
        pendingQuestions: [],
      },
    });

    const route = (await import("../state.post")).default;
    await route({} as never);

    const stored =
      getWorkspaceDatabase().workspaces.getWorkspace("workspace-1");
    const json = JSON.parse(stored?.workspaceJson ?? "{}");

    // Entity data must NOT be stored in workspace_json — it lives in graph tables
    expect(json.analysis).toBeUndefined();

    // Non-entity data should come from request snapshot
    expect(json.layout).toEqual({ e1: { x: 100, y: 200, pinned: true } });
  });

  it("loads entities into graph tables in import mode", async () => {
    getWorkspaceIdMock.mockReturnValue(null); // different workspace

    readBodyMock.mockResolvedValue({
      workspace: {
        id: "workspace-2",
        name: "Imported Workspace",
        analysisType: "game-theory",
        createdAt: 100,
        updatedAt: 200,
      },
      snapshot: {
        analysis: {
          id: "imported-analysis",
          name: "Imported",
          topic: "imported topic",
          entities: [{ id: "e1", type: "fact" }],
          relationships: [],
          phases: [],
        },
        layout: {},
      },
      import: true,
    });

    const route = (await import("../state.post")).default;
    await route({} as never);

    expect(loadAnalysisMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "imported-analysis" }),
      expect.objectContaining({ workspaceId: "workspace-2" }),
    );
  });

  it("returns 400 for invalid payloads", async () => {
    readBodyMock.mockResolvedValue({ workspace: { id: "" } });

    const route = (await import("../state.post")).default;
    const result = await route({} as never);

    expect(result).toEqual({ error: "Invalid workspace sync payload" });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 400);
  });
});
