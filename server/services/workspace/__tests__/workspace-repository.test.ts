import { describe, expect, it } from "vitest";
import {
  createCanonicalWorkspaceRecord,
  createWorkspaceRecordFromSnapshot,
} from "../workspace-repository";

describe("createCanonicalWorkspaceRecord", () => {
  it("does not include entity data in workspace_json", () => {
    const record = createCanonicalWorkspaceRecord({
      id: "ws-1",
      name: "Test",
      analysisType: "game-theory",
      nonEntityFields: {
        layout: { e1: { x: 10, y: 20, pinned: false } },
        threads: [{ id: "t1" }],
        artifacts: [],
        checkpointHeaders: [],
        pendingQuestions: [],
      },
      createdAt: 1000,
      updatedAt: 2000,
    });

    const json = JSON.parse(record.workspaceJson);
    expect(json.analysis).toBeUndefined();
    expect(json.layout).toEqual({ e1: { x: 10, y: 20, pinned: false } });
    expect(json.threads).toEqual([{ id: "t1" }]);
    expect(json.id).toBe("ws-1");
    expect(json.name).toBe("Test");
  });

  it("defaults non-entity fields to empty values", () => {
    const record = createCanonicalWorkspaceRecord({
      id: "ws-2",
      name: "Empty",
      analysisType: "game-theory",
      nonEntityFields: {},
    });

    const json = JSON.parse(record.workspaceJson);
    expect(json.layout).toEqual({});
    expect(json.threads).toEqual([]);
    expect(json.artifacts).toEqual([]);
    expect(json.checkpointHeaders).toEqual([]);
    expect(json.pendingQuestions).toEqual([]);
  });
});

describe("createWorkspaceRecordFromSnapshot", () => {
  it("strips entity data from snapshot before storing", () => {
    const record = createWorkspaceRecordFromSnapshot({
      id: "ws-1",
      name: "Test",
      analysisType: "game-theory",
      snapshot: {
        id: "ws-1",
        name: "Test",
        analysis: {
          id: "analysis-1",
          name: "Analysis",
          topic: "topic",
          entities: [{ id: "e1", type: "fact" }],
          relationships: [],
          phases: [],
        },
        layout: { e1: { x: 5, y: 10, pinned: true } },
        threads: [],
      },
      createdAt: 1000,
      updatedAt: 2000,
    });

    const json = JSON.parse(record.workspaceJson);
    expect(json.analysis).toBeUndefined();
    expect(json.layout).toEqual({ e1: { x: 5, y: 10, pinned: true } });
    expect(json.id).toBe("ws-1");
  });

  it("handles snapshot without analysis field", () => {
    const record = createWorkspaceRecordFromSnapshot({
      id: "ws-2",
      name: "Clean",
      analysisType: "game-theory",
      snapshot: {
        id: "ws-2",
        layout: {},
        threads: [],
      },
    });

    const json = JSON.parse(record.workspaceJson);
    expect(json.analysis).toBeUndefined();
    expect(json.layout).toEqual({});
  });

  it("handles null/undefined snapshot gracefully", () => {
    const record = createWorkspaceRecordFromSnapshot({
      id: "ws-3",
      name: "Null",
      analysisType: "game-theory",
      snapshot: null,
    });

    expect(JSON.parse(record.workspaceJson)).toBeNull();
  });
});
