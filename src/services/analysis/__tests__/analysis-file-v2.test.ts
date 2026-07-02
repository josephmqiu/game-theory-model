import { describe, expect, it } from "vitest";
import type { Analysis, LayoutState } from "@/types/entity";
import type { PhaseState } from "@/types/methodology";
import {
  parseAnalysisFileText,
  serializeAnalysisFile,
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
        provenance: { source: "user-edited", timestamp: 0 },
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

  it("loads pre-migration files that still carry the legacy source field (14A shim)", () => {
    // Written by builds before the provenance migration: entities carry a
    // top-level source and NO provenance. Still version 3 — never bumped.
    const preMigrationFile = JSON.stringify({
      type: "game-theory-analysis",
      version: 3,
      analysis: {
        id: "legacy-1",
        name: "Legacy Analysis",
        topic: "Legacy topic",
        entities: [
          {
            id: "e1",
            type: "fact",
            phase: "situational-grounding",
            data: {
              type: "fact",
              date: "2025-03-01",
              source: "Reuters",
              content: "Human-corrected fact",
              category: "action",
            },
            confidence: "high",
            source: "human",
            rationale: "Edited by hand",
            revision: 2,
            stale: false,
          },
          {
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
            rationale: "Key actor",
            revision: 1,
            stale: false,
          },
        ],
        relationships: [
          {
            id: "r1",
            type: "informed-by",
            fromEntityId: "e2",
            toEntityId: "e1",
            source: "ai",
          },
        ],
        phases: [],
      },
      layout: {},
    });

    const parsed = parseAnalysisFileText(preMigrationFile);

    const [human, ai] = parsed.analysis.entities;
    // Legacy source is stripped and re-expressed as provenance
    expect("source" in human).toBe(false);
    expect(human.provenance).toEqual({ source: "user-edited", timestamp: 0 });
    expect("source" in ai).toBe(false);
    expect(ai.provenance).toEqual({ source: "phase-derived", timestamp: 0 });
    expect("source" in parsed.analysis.relationships[0]).toBe(false);
  });

  it("legacy source never overrides an existing provenance record", () => {
    const mixedFile = JSON.stringify({
      type: "game-theory-analysis",
      version: 3,
      analysis: {
        id: "mixed-1",
        name: "Mixed",
        topic: "Mixed",
        entities: [
          {
            id: "e1",
            type: "fact",
            phase: "situational-grounding",
            data: {
              type: "fact",
              date: "2025-03-01",
              source: "Reuters",
              content: "A fact",
              category: "action",
            },
            confidence: "high",
            source: "ai",
            provenance: { source: "user-edited", timestamp: 1234 },
            rationale: "r",
            revision: 1,
            stale: false,
          },
        ],
        relationships: [],
        phases: [],
      },
      layout: {},
    });

    const parsed = parseAnalysisFileText(mixedFile);
    expect(parsed.analysis.entities[0].provenance).toEqual({
      source: "user-edited",
      timestamp: 1234,
    });
  });

  it("tolerates and round-trips revisionLog fields while staying version 3 (E4A)", () => {
    const analysis = createTestAnalysis();
    analysis.entities[0].revisionLog = [
      {
        logNo: 1,
        ts: 1719900000000,
        logSource: "phase",
        runId: "run-1",
        fieldDiffs: [],
      },
      {
        logNo: 2,
        ts: 1719900001000,
        logSource: "human",
        fieldDiffs: [{ field: "data.content", old: '"a"', new: '"b"' }],
      },
    ];
    const layout = createTestLayout();

    const text = serializeAnalysisFile(analysis, layout);
    expect((JSON.parse(text) as { version: number }).version).toBe(3);

    const parsed = parseAnalysisFileText(text);
    expect(parsed.analysis.entities[0].revisionLog).toEqual(
      analysis.entities[0].revisionLog,
    );

    // And a file WITHOUT the log still loads — the field is optional
    const bare = createTestAnalysis();
    const bareParsed = parseAnalysisFileText(
      serializeAnalysisFile(bare, layout),
    );
    expect(bareParsed.analysis.entities[0].revisionLog).toBeUndefined();
  });

  it("serialization writes no legacy top-level source fields", () => {
    const analysis = createTestAnalysis();
    const text = serializeAnalysisFile(analysis, createTestLayout());
    const raw = JSON.parse(text) as {
      analysis: {
        entities: Array<Record<string, unknown>>;
        relationships: Array<Record<string, unknown>>;
      };
    };
    for (const entity of raw.analysis.entities) {
      expect("source" in entity).toBe(false);
    }
    for (const relationship of raw.analysis.relationships) {
      expect("source" in relationship).toBe(false);
    }
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
});
