import { describe, it, expect, beforeEach } from "vitest";
import * as entityGraphService from "../entity-graph-service";
import {
  serializeGraphSummary,
  synthesizeReport,
  SYNTHESIS_SYSTEM_PROMPT,
} from "../synthesis-service";
import type { AnalysisEntity } from "../../../shared/types/entity";

// ── Fixtures ──

function makeEntity(
  overrides: Partial<AnalysisEntity> & {
    id: string;
    type: AnalysisEntity["type"];
  },
): AnalysisEntity {
  return {
    phase: "situational-grounding",
    data: {
      type: "fact",
      date: "2026-03-23",
      source: "test",
      content: "A fact",
      category: "action" as const,
    },
    confidence: "high",
    source: "ai",
    rationale: "test",
    revision: 1,
    stale: false,
    ...overrides,
  } as AnalysisEntity;
}

// ── Setup ──

beforeEach(() => {
  entityGraphService._resetForTest();
});

// ── Tests ──

describe("synthesis system prompt", () => {
  it("provides AI instructions for generating executive analysis reports from entity graphs", () => {
    expect(typeof SYNTHESIS_SYSTEM_PROMPT).toBe("string");
    expect(SYNTHESIS_SYSTEM_PROMPT.length).toBeGreaterThan(0);
    // The prompt must instruct the AI about the key report fields
    expect(SYNTHESIS_SYSTEM_PROMPT).toContain("executive_summary");
    expect(SYNTHESIS_SYSTEM_PROMPT).toContain("entity_references");
  });
});

describe("graph serialization for AI context", () => {
  it("serializes each entity as [id] type (phase): name for compact AI consumption", () => {
    const entities: AnalysisEntity[] = [
      makeEntity({
        id: "e1",
        type: "player",
        phase: "player-identification",
        data: {
          type: "player",
          name: "USA",
          playerType: "primary",
          knowledge: [],
        },
      }),
      makeEntity({
        id: "e2",
        type: "fact",
        phase: "situational-grounding",
        data: {
          type: "fact",
          date: "2026-03-23",
          source: "test",
          content: "A key fact",
          category: "action",
        },
      }),
    ];

    const result = serializeGraphSummary(entities);
    const lines = result.split("\n");

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("[e1] player (player-identification): USA");
    expect(lines[1]).toBe("[e2] fact (situational-grounding): A key fact");
  });

  it("falls back to content field for entity types without a name (e.g. facts)", () => {
    const entities: AnalysisEntity[] = [
      makeEntity({
        id: "f1",
        type: "fact",
        phase: "situational-grounding",
        data: {
          type: "fact",
          date: "2026-03-23",
          source: "test",
          content: "Important fact",
          category: "action",
        },
      }),
    ];

    const result = serializeGraphSummary(entities);
    expect(result).toBe("[f1] fact (situational-grounding): Important fact");
  });

  it("falls back to entity id when neither name nor content exists (e.g. payoff-matrix)", () => {
    const entities: AnalysisEntity[] = [
      makeEntity({
        id: "x1",
        type: "payoff-matrix",
        phase: "formal-modeling",
        data: {
          type: "payoff-matrix",
          game_id: "g1",
          players: [],
          strategies: {},
          payoffs: [],
        } as any,
      }),
    ];

    const result = serializeGraphSummary(entities);
    expect(result).toBe("[x1] payoff-matrix (formal-modeling): x1");
  });

  it("returns empty string for an empty graph -- nothing to serialize for AI", () => {
    const result = serializeGraphSummary([]);
    expect(result).toBe("");
  });
});

describe("report synthesis from entity graph", () => {
  it("skips synthesis when the entity graph is empty -- no entities means no analysis to summarize", async () => {
    entityGraphService.newAnalysis("test topic");
    const result = await synthesizeReport();
    expect(result).toBeNull();
  });

  it("returns null on AI failure instead of throwing -- synthesis errors must not crash the analysis", async () => {
    entityGraphService.newAnalysis("test topic");
    entityGraphService.createEntity(
      {
        type: "fact",
        phase: "situational-grounding",
        data: {
          type: "fact",
          date: "2026-03-23",
          source: "test",
          content: "A fact",
          category: "action" as const,
        },
        confidence: "high",
        rationale: "test",
        revision: 1,
        stale: false,
      },
      {
        source: "phase-derived",
        runId: "run-1",
        phase: "situational-grounding",
      },
    );

    // No aiCaller provided, so the stub throws -- synthesizeReport should catch and return null
    const result = await synthesizeReport();
    expect(result).toBeNull();
  });

  it("returns null when aiCaller throws -- any AI transport/parse failure is non-fatal", async () => {
    entityGraphService.newAnalysis("test topic");
    entityGraphService.createEntity(
      {
        type: "fact",
        phase: "situational-grounding",
        data: {
          type: "fact",
          date: "2026-03-23",
          source: "test",
          content: "A fact",
          category: "action" as const,
        },
        confidence: "high",
        rationale: "test",
        revision: 1,
        stale: false,
      },
      {
        source: "phase-derived",
        runId: "run-1",
        phase: "situational-grounding",
      },
    );

    const result = await synthesizeReport({
      aiCaller: async () => {
        throw new Error("Connection refused");
      },
    });
    expect(result).toBeNull();
  });

  it("creates the report entity and typed relationship edges for each entity reference", async () => {
    entityGraphService.newAnalysis("test topic");

    const player = entityGraphService.createEntity(
      {
        type: "player",
        phase: "player-identification",
        data: {
          type: "player",
          name: "USA",
          playerType: "primary",
          knowledge: [],
        },
        confidence: "high",
        rationale: "test",
        revision: 1,
        stale: false,
      },
      {
        source: "phase-derived",
        runId: "run-1",
        phase: "player-identification",
      },
    );

    const scenario = entityGraphService.createEntity(
      {
        type: "scenario",
        phase: "scenarios",
        data: {
          type: "scenario",
          subtype: "baseline",
          narrative: "Most likely outcome: gradual de-escalation",
          probability: { point: 60, rangeLow: 45, rangeHigh: 75 },
          key_assumptions: ["Economic pressure continues"],
          invalidation_conditions: "Military escalation",
          model_basis: ["equilibrium-1"],
          cross_game_interactions: "None significant",
          prediction_basis: "equilibrium",
          trigger: null,
          why_unlikely: null,
          consequences: null,
          drift_trajectory: null,
        },
        confidence: "medium",
        rationale: "test",
        revision: 1,
        stale: false,
      },
      { source: "phase-derived", runId: "run-1", phase: "scenarios" },
    );

    const assumption = entityGraphService.createEntity(
      {
        type: "assumption",
        phase: "assumptions",
        data: {
          type: "assumption",
          description: "No third-party escalation will occur",
          sensitivity: "high",
          category: "behavioral",
          classification: "empirical",
          correlatedClusterId: null,
          rationale: "Historical pattern of restraint",
          dependencies: [],
        },
        confidence: "high",
        rationale: "test",
        revision: 1,
        stale: false,
      },
      { source: "phase-derived", runId: "run-1", phase: "assumptions" },
    );

    const equilibrium = entityGraphService.createEntity(
      {
        type: "equilibrium-result",
        phase: "formal-modeling",
        data: {
          type: "equilibrium-result",
          gameName: "Trade negotiation",
          equilibriumType: "nash",
          description: "Both cooperate under mutual pressure",
          strategies: [
            { player: "USA", strategy: "Negotiate" },
            { player: "China", strategy: "Negotiate" },
          ],
          selectionFactors: [
            {
              factor: "focal-points",
              evidence: "Prior agreements",
              weight: "high",
            },
          ],
        },
        confidence: "high",
        rationale: "test",
        revision: 1,
        stale: false,
      },
      { source: "phase-derived", runId: "run-1", phase: "formal-modeling" },
    );

    const fakeReportData = {
      type: "analysis-report" as const,
      executive_summary: "The situation favors de-escalation.",
      why: "Both players face domestic pressure.",
      key_evidence: ["Tariff costs exceed benefits"],
      open_assumptions: ["No third-party escalation"],
      entity_references: [
        { entity_id: player.id, display_name: "USA" },
        { entity_id: scenario.id, display_name: "Base case" },
        { entity_id: assumption.id, display_name: "No third-party escalation" },
        { entity_id: equilibrium.id, display_name: "Both cooperate" },
      ],
      prediction_verdict: null,
      what_would_change: ["Military incident in Taiwan Strait"],
      source_url: null,
      analysis_timestamp: "2026-03-23T12:00:00Z",
    };

    const result = await synthesizeReport({
      aiCaller: async () => fakeReportData,
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe("analysis-report");

    // Verify the report entity was created in the graph
    const analysis = entityGraphService.getAnalysis();
    const reportEntity = analysis.entities.find(
      (e) => e.type === "analysis-report",
    );
    expect(reportEntity).toBeDefined();

    // Verify relationship edges from report to referenced entities
    const reportRelationships = analysis.relationships.filter(
      (r) => r.fromEntityId === reportEntity!.id,
    );
    expect(reportRelationships).toHaveLength(4);

    // Player references get "informed-by" relationship type
    const playerRel = reportRelationships.find(
      (r) => r.toEntityId === player.id,
    );
    expect(playerRel).toBeDefined();
    expect(playerRel!.type).toBe("informed-by");

    // Scenario references get "derived-from" relationship type
    const scenarioRel = reportRelationships.find(
      (r) => r.toEntityId === scenario.id,
    );
    expect(scenarioRel).toBeDefined();
    expect(scenarioRel!.type).toBe("derived-from");

    // Assumption references get "depends-on" relationship type
    const assumptionRel = reportRelationships.find(
      (r) => r.toEntityId === assumption.id,
    );
    expect(assumptionRel).toBeDefined();
    expect(assumptionRel!.type).toBe("depends-on");

    // Equilibrium-result references get "derived-from" relationship type
    const equilibriumRel = reportRelationships.find(
      (r) => r.toEntityId === equilibrium.id,
    );
    expect(equilibriumRel).toBeDefined();
    expect(equilibriumRel!.type).toBe("derived-from");
  });

  it("gracefully skips deleted entity references instead of crashing -- graph may change between synthesis and commit", async () => {
    entityGraphService.newAnalysis("test topic");

    const player = entityGraphService.createEntity(
      {
        type: "player",
        phase: "player-identification",
        data: {
          type: "player",
          name: "USA",
          playerType: "primary",
          knowledge: [],
        },
        confidence: "high",
        rationale: "test",
        revision: 1,
        stale: false,
      },
      {
        source: "phase-derived",
        runId: "run-1",
        phase: "player-identification",
      },
    );

    const fakeReportData = {
      type: "analysis-report" as const,
      executive_summary: "Summary.",
      why: "Reason.",
      key_evidence: ["Evidence"],
      open_assumptions: [],
      entity_references: [
        { entity_id: player.id, display_name: "USA" },
        { entity_id: "non-existent-id", display_name: "Ghost entity" },
      ],
      prediction_verdict: null,
      what_would_change: ["Something changes"],
      source_url: null,
      analysis_timestamp: "2026-03-23T12:00:00Z",
    };

    const result = await synthesizeReport({
      aiCaller: async () => fakeReportData,
    });

    expect(result).not.toBeNull();

    const analysis = entityGraphService.getAnalysis();
    const reportEntity = analysis.entities.find(
      (e) => e.type === "analysis-report",
    );
    const reportRelationships = analysis.relationships.filter(
      (r) => r.fromEntityId === reportEntity!.id,
    );

    // Only the valid reference creates a relationship; the ghost reference is silently skipped
    expect(reportRelationships).toHaveLength(1);
    expect(reportRelationships[0].toEntityId).toBe(player.id);
  });
});
