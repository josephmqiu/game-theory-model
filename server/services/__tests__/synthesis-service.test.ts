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

describe("SYNTHESIS_SYSTEM_PROMPT", () => {
  it("is a non-empty string constant", () => {
    expect(typeof SYNTHESIS_SYSTEM_PROMPT).toBe("string");
    expect(SYNTHESIS_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });
});

describe("serializeGraphSummary", () => {
  it("produces one line per entity: [id] type (phase): name", () => {
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

  it("uses content field when name is absent (e.g. fact entities)", () => {
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

  it("falls back to entity id when neither name nor content is present", () => {
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

  it("returns empty string for empty entity array", () => {
    const result = serializeGraphSummary([]);
    expect(result).toBe("");
  });
});

describe("synthesizeReport", () => {
  it("returns null when entity graph is empty", async () => {
    entityGraphService.newAnalysis("test topic");
    const result = await synthesizeReport();
    expect(result).toBeNull();
  });

  it("catches errors and returns null (does not throw)", async () => {
    // Populate graph with at least one entity so it gets past the empty check
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

    // The AI call is stubbed and throws — synthesizeReport should catch and return null
    const result = await synthesizeReport();
    expect(result).toBeNull();
  });

  it("creates relationships for each entity_reference when synthesis succeeds", async () => {
    entityGraphService.newAnalysis("test topic");

    // Create entities that will be referenced
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

    // Call synthesizeReport with a custom AI caller that returns valid data
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

    // Check that relationships were created
    const analysis = entityGraphService.getAnalysis();
    const reportEntity = analysis.entities.find(
      (e) => e.type === "analysis-report",
    );
    expect(reportEntity).toBeDefined();

    const reportRelationships = analysis.relationships.filter(
      (r) => r.fromEntityId === reportEntity!.id,
    );

    // Should have 4 relationships (one per entity_reference)
    expect(reportRelationships).toHaveLength(4);

    // player → informed-by
    const playerRel = reportRelationships.find(
      (r) => r.toEntityId === player.id,
    );
    expect(playerRel).toBeDefined();
    expect(playerRel!.type).toBe("informed-by");

    // scenario → derived-from
    const scenarioRel = reportRelationships.find(
      (r) => r.toEntityId === scenario.id,
    );
    expect(scenarioRel).toBeDefined();
    expect(scenarioRel!.type).toBe("derived-from");

    // assumption → depends-on
    const assumptionRel = reportRelationships.find(
      (r) => r.toEntityId === assumption.id,
    );
    expect(assumptionRel).toBeDefined();
    expect(assumptionRel!.type).toBe("depends-on");

    // equilibrium-result → derived-from
    const equilibriumRel = reportRelationships.find(
      (r) => r.toEntityId === equilibrium.id,
    );
    expect(equilibriumRel).toBeDefined();
    expect(equilibriumRel!.type).toBe("derived-from");
  });

  it("skips relationship creation for entity_references with non-existent IDs", async () => {
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

    // Only 1 relationship — the non-existent reference is skipped
    expect(reportRelationships).toHaveLength(1);
    expect(reportRelationships[0].toEntityId).toBe(player.id);
  });
});
