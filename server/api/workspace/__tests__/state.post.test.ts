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

describe("/api/workspace/state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkspaceDatabaseForTest();
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

    const stored = getWorkspaceDatabase().workspaces.getWorkspace("workspace-1");
    expect(stored).toBeDefined();
    expect(stored?.filePath).toBe("/tmp/trade-war.gta");
    expect(JSON.parse(stored?.workspaceJson ?? "{}")).toMatchObject({
      id: "workspace-1",
      analysisType: "game-theory",
    });
  });

  it("returns 400 for invalid payloads", async () => {
    readBodyMock.mockResolvedValue({ workspace: { id: "" } });

    const route = (await import("../state.post")).default;
    const result = await route({} as never);

    expect(result).toEqual({ error: "Invalid workspace sync payload" });
    expect(setResponseStatusMock).toHaveBeenCalledWith(expect.anything(), 400);
  });
});
