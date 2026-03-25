import { describe, expect, it } from "vitest";
import type { Analysis, LayoutState } from "@/types/entity";
import type { PhaseState } from "@/types/methodology";
import type { Workspace } from "@/types/workspace";
import {
  createWorkspaceFromAnalysis,
  parseWorkspaceFileText,
  parseAnalysisFileText,
  serializeAnalysisFile,
  serializeWorkspaceFile,
  createDefaultAnalysisFileName,
} from "@/services/analysis/analysis-file";

function createTestAnalysis(): Analysis {
  const phases: PhaseState[] = [
    { phase: "situational-grounding", status: "complete", entityIds: ["e1"] },
    { phase: "player-identification", status: "pending", entityIds: [] },
    { phase: "baseline-model", status: "pending", entityIds: [] },
  ];

  return {
    id: "analysis-1",
    name: "Trade War Analysis",
    topic: "US-China trade tensions",
    entities: [
      {
        id: "e1",
        type: "fact",
        phase: "situational-grounding",
        data: {
          type: "fact",
          date: "2025-03-01",
          source: "Reuters",
          content: "New tariffs announced",
          category: "action",
        },
        confidence: "high",
        source: "human",
        rationale: "Directly reported",
        revision: 1,
        stale: false,
      },
    ],
    relationships: [],
    phases,
  };
}

function createTestLayout(): LayoutState {
  return {
    e1: { x: 100, y: 200, pinned: true },
  };
}

function createTestWorkspace(): Workspace {
  return createWorkspaceFromAnalysis(createTestAnalysis(), createTestLayout(), {
    id: "workspace-1",
    name: "Trade War Workspace",
    createdAt: 1_741_000_000_000,
    updatedAt: 1_741_000_001_000,
  });
}

describe("v3 entity analysis file format", () => {
  it("round-trips an Analysis through serialize and parse", () => {
    const analysis = createTestAnalysis();
    const layout = createTestLayout();
    const text = serializeAnalysisFile(analysis, layout);
    const parsed = parseAnalysisFileText(text);

    expect(parsed).toEqual({ analysis, layout });
  });

  it("preserves entities with relationships through round-trip", () => {
    const analysis = createTestAnalysis();
    analysis.entities.push({
      id: "e2",
      type: "player",
      phase: "player-identification",
      data: {
        type: "player",
        name: "United States",
        playerType: "primary",
        knowledge: [],
      },
      confidence: "high",
      source: "ai",
      rationale: "Key actor in trade dispute",
      revision: 1,
      stale: false,
    });
    analysis.relationships.push({
      id: "r1",
      type: "informed-by",
      fromEntityId: "e2",
      toEntityId: "e1",
    });

    const layout = {
      ...createTestLayout(),
      e2: { x: 300, y: 400, pinned: false },
    };
    const text = serializeAnalysisFile(analysis, layout);
    const parsed = parseAnalysisFileText(text);

    expect(parsed.analysis.entities).toHaveLength(2);
    expect(parsed.analysis.relationships).toHaveLength(1);
    expect(parsed.analysis.relationships[0]).toEqual(analysis.relationships[0]);
    expect(parsed.layout.e2).toEqual({ x: 300, y: 400, pinned: false });
  });

  it("loads legacy v3 analysis-root files into a workspace envelope", () => {
    const analysis = createTestAnalysis();
    const layout = createTestLayout();
    const legacyFile = JSON.stringify({
      type: "game-theory-analysis",
      version: 3,
      analysis,
      layout,
    });

    const parsed = parseWorkspaceFileText(legacyFile);

    expect(parsed.analysis).toEqual(analysis);
    expect(parsed.layout).toEqual(layout);
    expect(parsed.workspace.analysis).toEqual(analysis);
    expect(parsed.workspace.layout).toEqual(layout);
    expect(parsed.workspace.analysisType).toBe("game-theory");
    expect(parsed.workspace.threads).toEqual([]);
    expect(parsed.workspace.artifacts).toEqual([]);
    expect(parsed.workspace.checkpointHeaders).toEqual([]);
    expect(parsed.workspace.pendingQuestions).toEqual([]);
  });

  it("round-trips a v4 workspace envelope", () => {
    const workspace = createTestWorkspace();

    const text = serializeWorkspaceFile(workspace);
    const parsed = parseWorkspaceFileText(text);

    expect(parsed.workspace).toEqual(workspace);
    expect(parsed.analysis).toEqual(workspace.analysis);
    expect(parsed.layout).toEqual(workspace.layout);
  });

  it("always saves analysis files as the workspace envelope format", () => {
    const text = serializeAnalysisFile(createTestAnalysis(), createTestLayout());
    const parsed = JSON.parse(text);

    expect(parsed.type).toBe("game-theory-workspace");
    expect(parsed.version).toBe(4);
    expect(parsed.workspace.analysis).toBeDefined();
    expect(parsed.workspace.layout).toBeDefined();
  });

  it("rejects non-portable runtime fields in workspace files", () => {
    const workspace = {
      ...createTestWorkspace(),
      providerSessionBindings: [{ threadId: "thread-1", sessionId: "sess-1" }],
    };

    expect(() =>
      parseWorkspaceFileText(
        JSON.stringify({
          type: "game-theory-workspace",
          version: 4,
          workspace,
        }),
      ),
    ).toThrow("workspace.providerSessionBindings is not portable");
  });

  it("rejects v1 files with an upgrade message", () => {
    const v1File = JSON.stringify({
      type: "game-theory-analysis",
      version: 2,
      analysis: {
        id: "old",
        name: "Old Analysis",
        players: [
          { id: "p1", name: "A", strategies: [{ id: "s1", name: "X" }] },
          { id: "p2", name: "B", strategies: [{ id: "s2", name: "Y" }] },
        ],
        profiles: [
          { player1StrategyId: "s1", player2StrategyId: "s2", payoffs: [1, 2] },
        ],
      },
    });

    expect(() => parseAnalysisFileText(v1File)).toThrow(
      "This file uses an older format. Please create a new analysis.",
    );
  });

  it("rejects files with an unknown version", () => {
    const badVersion = JSON.stringify({
      type: "game-theory-analysis",
      version: 99,
      analysis: createTestAnalysis(),
      layout: createTestLayout(),
    });

    expect(() => parseAnalysisFileText(badVersion)).toThrow(
      "Unsupported analysis file version: 99.",
    );
  });

  it("rejects files with an unknown type", () => {
    const badType = JSON.stringify({
      type: "not-a-real-type",
      version: 3,
      analysis: createTestAnalysis(),
      layout: createTestLayout(),
    });

    expect(() => parseAnalysisFileText(badType)).toThrow(
      "Unsupported analysis file type: not-a-real-type.",
    );
  });

  it("rejects corrupted JSON", () => {
    expect(() => parseAnalysisFileText("{not json")).toThrow(
      "Analysis file is not valid JSON.",
    );
  });

  it("rejects non-object JSON", () => {
    expect(() => parseAnalysisFileText('"a string"')).toThrow(
      "Analysis file must be a JSON object.",
    );
  });

  it("rejects a v2 file with missing analysis fields", () => {
    const missingTopic = JSON.stringify({
      type: "game-theory-analysis",
      version: 3,
      analysis: {
        id: "a1",
        name: "Test",
        // topic missing
        entities: [],
        relationships: [],
        phases: [],
      },
      layout: {},
    });

    expect(() => parseAnalysisFileText(missingTopic)).toThrow(
      "analysis.topic must be a string.",
    );
  });

  it("generates a file name from the analysis name", () => {
    const analysis = createTestAnalysis();
    expect(createDefaultAnalysisFileName(analysis)).toBe(
      "trade-war-analysis.gta",
    );
  });

  it("generates a fallback file name for empty names", () => {
    const analysis = createTestAnalysis();
    analysis.name = "  ";
    expect(createDefaultAnalysisFileName(analysis)).toBe(
      "untitled-analysis.gta",
    );
  });

  it("serialized workspaces do not include runtime logs or command receipts", () => {
    const text = serializeWorkspaceFile(createTestWorkspace());

    expect(text).not.toContain("providerSessionBindings");
    expect(text).not.toContain("commandReceipts");
    expect(text).not.toContain("runtimeLogs");
    expect(text).not.toContain('"logs"');
  });
});
