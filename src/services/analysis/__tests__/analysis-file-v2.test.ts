import { describe, expect, it } from "vitest";
import type { Analysis } from "@/types/entity";
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
        position: { x: 100, y: 200 },
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

describe("v2 entity analysis file format", () => {
  it("round-trips an Analysis through serialize and parse", () => {
    const analysis = createTestAnalysis();
    const text = serializeAnalysisFile(analysis);
    const parsed = parseAnalysisFileText(text);

    expect(parsed).toEqual(analysis);
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
      position: { x: 300, y: 400 },
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

    const text = serializeAnalysisFile(analysis);
    const parsed = parseAnalysisFileText(text);

    expect(parsed.entities).toHaveLength(2);
    expect(parsed.relationships).toHaveLength(1);
    expect(parsed.relationships[0]).toEqual(analysis.relationships[0]);
  });

  it("rejects v1 files with an upgrade message", () => {
    const v1File = JSON.stringify({
      type: "game-theory-analysis",
      version: 1,
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
    });

    expect(() => parseAnalysisFileText(badVersion)).toThrow(
      "Unsupported analysis file version: 99.",
    );
  });

  it("rejects files with an unknown type", () => {
    const badType = JSON.stringify({
      type: "not-a-real-type",
      version: 2,
      analysis: createTestAnalysis(),
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
      version: 2,
      analysis: {
        id: "a1",
        name: "Test",
        // topic missing
        entities: [],
        relationships: [],
        phases: [],
      },
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
});
