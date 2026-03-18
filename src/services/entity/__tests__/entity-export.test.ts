import { describe, it, expect } from "vitest";
import { exportToMarkdown } from "../entity-export";
import type { AnalysisEntity, EntityAnalysis } from "@/types/entity";

const makeEntity = (
  overrides: Partial<AnalysisEntity> = {},
): AnalysisEntity => ({
  id: "e1",
  type: "fact",
  phase: "situational-grounding",
  data: {
    type: "fact",
    date: "2026-01-15",
    source: "Reuters",
    content: "Country A imposed tariffs",
    category: "action",
  },
  position: { x: 0, y: 0 },
  confidence: "high",
  source: "ai",
  rationale: "Test",
  revision: 1,
  stale: false,
  ...overrides,
});

const makeAnalysis = (
  overrides: Partial<EntityAnalysis> = {},
): EntityAnalysis => ({
  id: "a1",
  name: "Trade War Analysis",
  topic: "US-China trade conflict",
  entities: [],
  relationships: [],
  phases: [],
  ...overrides,
});

describe("exportToMarkdown", () => {
  it("renders full analysis with entities across Phases 1-3", () => {
    const analysis = makeAnalysis({
      entities: [
        makeEntity({
          id: "f1",
          type: "fact",
          phase: "situational-grounding",
          confidence: "high",
          data: {
            type: "fact",
            date: "2026-01-15",
            source: "Reuters",
            content: "Country A imposed tariffs",
            category: "action",
          },
        }),
        makeEntity({
          id: "p1",
          type: "player",
          phase: "player-identification",
          confidence: "high",
          data: {
            type: "player",
            name: "Country A",
            playerType: "primary",
            knowledge: ["Trade data", "Domestic polling"],
          },
        }),
        makeEntity({
          id: "o1",
          type: "objective",
          phase: "player-identification",
          confidence: "medium",
          data: {
            type: "objective",
            description: "Maintain trade surplus",
            priority: "high",
            stability: "stable",
          },
        }),
        makeEntity({
          id: "g1",
          type: "game",
          phase: "baseline-model",
          confidence: "medium",
          data: {
            type: "game",
            name: "Tariff Escalation",
            gameType: "chicken",
            timing: "simultaneous",
            description: "Both sides choose escalation levels",
          },
        }),
        makeEntity({
          id: "s1",
          type: "strategy",
          phase: "baseline-model",
          confidence: "high",
          data: {
            type: "strategy",
            name: "Escalate",
            feasibility: "actual",
            description: "Raise tariffs further",
          },
        }),
        makeEntity({
          id: "ir1",
          type: "institutional-rule",
          phase: "baseline-model",
          confidence: "high",
          data: {
            type: "institutional-rule",
            name: "WTO Rules",
            ruleType: "international",
            effectOnStrategies: "Limits tariff escalation",
          },
        }),
        makeEntity({
          id: "er1",
          type: "escalation-rung",
          phase: "baseline-model",
          confidence: "high",
          data: {
            type: "escalation-rung",
            action: "Impose sanctions",
            reversibility: "partially-reversible",
            climbed: false,
            order: 1,
          },
        }),
        makeEntity({
          id: "er2",
          type: "escalation-rung",
          phase: "baseline-model",
          confidence: "high",
          data: {
            type: "escalation-rung",
            action: "Full embargo",
            reversibility: "irreversible",
            climbed: true,
            order: 2,
          },
        }),
      ],
      relationships: [
        {
          id: "r1",
          type: "has-objective",
          fromEntityId: "p1",
          toEntityId: "o1",
        },
      ],
    });

    const md = exportToMarkdown(analysis);

    // Title and topic
    expect(md).toContain("# Game Theory Analysis: Trade War Analysis");
    expect(md).toContain("**Topic:** US-China trade conflict");

    // Phase 1
    expect(md).toContain("## Phase 1: Situational Grounding");
    expect(md).toContain("### Facts");
    expect(md).toContain("**2026-01-15**");
    expect(md).toContain("Country A imposed tariffs");
    expect(md).toContain("(Source: Reuters)");
    expect(md).toContain("[Confidence: high]");

    // Phase 2
    expect(md).toContain("## Phase 2: Player Identification");
    expect(md).toContain("### Players");
    expect(md).toContain("#### Country A (primary)");
    expect(md).toContain("Trade data");
    expect(md).toContain("### Objectives");
    expect(md).toContain("Maintain trade surplus");
    expect(md).toContain("[high]");
    expect(md).toContain("[Confidence: medium]");

    // Phase 3
    expect(md).toContain("## Phase 3: Baseline Model");
    expect(md).toContain("### Games");
    expect(md).toContain("#### Tariff Escalation (chicken, simultaneous)");
    expect(md).toContain("Both sides choose escalation levels");
    expect(md).toContain("### Strategies");
    expect(md).toContain("Escalate");
    expect(md).toContain("[actual]");
    expect(md).toContain("### Institutional Rules");
    expect(md).toContain("**WTO Rules** (international)");
    expect(md).toContain("Limits tariff escalation");
    expect(md).toContain("### Escalation Ladder");
    expect(md).toContain("Impose sanctions");
    expect(md).toContain("[partially-reversible]");
    // Escalation rung ordering and climbed markers
    expect(md).toMatch(/1\.\s.*Impose sanctions/);
    expect(md).toMatch(/2\.\s.*Full embargo/);
    expect(md).toContain("○ Available");
    expect(md).toContain("✓ Climbed");

    // Relationships section
    expect(md).toContain("## Relationships");
    expect(md).toContain("has-objective");
  });

  it("renders empty analysis with no-entities message", () => {
    const analysis = makeAnalysis({ name: "", topic: "", entities: [] });
    const md = exportToMarkdown(analysis);
    expect(md).toBe(
      "# Game Theory Analysis\n\nNo entities. Run an analysis first.",
    );
  });

  it("renders partial analysis (Phase 1 only)", () => {
    const analysis = makeAnalysis({
      entities: [
        makeEntity({
          id: "f1",
          type: "fact",
          phase: "situational-grounding",
          data: {
            type: "fact",
            date: "2026-03-01",
            source: "AP",
            content: "Summit announced",
            category: "action",
          },
        }),
      ],
    });

    const md = exportToMarkdown(analysis);
    expect(md).toContain("## Phase 1: Situational Grounding");
    expect(md).toContain("Summit announced");
    // Should NOT contain other phases
    expect(md).not.toContain("## Phase 2");
    expect(md).not.toContain("## Phase 3");
  });

  it("shows confidence level for low-confidence entities", () => {
    const analysis = makeAnalysis({
      entities: [
        makeEntity({
          id: "f1",
          confidence: "low",
        }),
      ],
    });

    const md = exportToMarkdown(analysis);
    expect(md).toContain("[Confidence: low]");
  });

  it("uses placeholder for entities with empty/null fields", () => {
    const analysis = makeAnalysis({
      entities: [
        makeEntity({
          id: "f1",
          type: "fact",
          phase: "situational-grounding",
          data: {
            type: "fact",
            date: "",
            source: "",
            content: "",
            category: "action",
          },
        }),
        makeEntity({
          id: "g1",
          type: "game",
          phase: "baseline-model",
          data: {
            type: "game",
            name: "Test Game",
            gameType: "chicken",
            timing: "simultaneous",
            description: "",
          },
        }),
        makeEntity({
          id: "s1",
          type: "strategy",
          phase: "baseline-model",
          data: {
            type: "strategy",
            name: "Test Strategy",
            feasibility: "actual",
            description: "",
          },
        }),
      ],
    });

    const md = exportToMarkdown(analysis);
    // Empty fact fields get placeholder
    expect(md).toContain("**—**");
    // Empty game description handled gracefully (no blank line where description would be)
    expect(md).not.toMatch(/#### Test Game.*\n\n\n/);
  });
});
