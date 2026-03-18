import { describe, expect, it } from "vitest";
import {
  createPhaseWorker,
  phase1Worker,
  phase2Worker,
  phase3Worker,
} from "@/services/ai/phase-worker";

// ── Fixtures ──

const VALID_PHASE_1_OUTPUT = JSON.stringify({
  entities: [
    {
      id: "fact-1",
      type: "fact",
      phase: "situational-grounding",
      data: {
        type: "fact",
        date: "2025-06-15",
        source: "Reuters",
        content: "Country A imposed 25% tariffs on Country B steel imports",
        category: "action",
      },
      position: { x: 0, y: 0 },
      confidence: "high",
      source: "ai",
      rationale: "Confirmed by official trade records",
      revision: 1,
      stale: false,
    },
    {
      id: "fact-2",
      type: "fact",
      phase: "situational-grounding",
      data: {
        type: "fact",
        date: "2025-06-20",
        source: "Bloomberg",
        content: "Country B steel exports dropped 40% in the first week",
        category: "economic",
      },
      position: { x: 0, y: 0 },
      confidence: "medium",
      source: "ai",
      rationale: "Early data, may be revised",
      revision: 1,
      stale: false,
    },
  ],
  relationships: [
    {
      id: "rel-1",
      type: "precedes",
      fromEntityId: "fact-1",
      toEntityId: "fact-2",
    },
  ],
});

const VALID_PHASE_2_OUTPUT = JSON.stringify({
  entities: [
    {
      id: "player-a",
      type: "player",
      phase: "player-identification",
      data: {
        type: "player",
        name: "Country A",
        playerType: "primary",
        knowledge: ["Own tariff schedule", "Domestic industry capacity"],
      },
      position: { x: 0, y: 0 },
      confidence: "high",
      source: "ai",
      rationale: "Initiator of the tariff action",
      revision: 1,
      stale: false,
    },
    {
      id: "obj-a1",
      type: "objective",
      phase: "player-identification",
      data: {
        type: "objective",
        description: "Protect domestic steel industry",
        priority: "high",
        stability: "stable",
      },
      position: { x: 0, y: 0 },
      confidence: "high",
      source: "ai",
      rationale: "Stated policy goal backed by legislation",
      revision: 1,
      stale: false,
    },
    {
      id: "obj-a2",
      type: "objective",
      phase: "player-identification",
      data: {
        type: "objective",
        description: "Maintain trade relationships with allies",
        priority: "tradable",
        stability: "shifting",
      },
      position: { x: 0, y: 0 },
      confidence: "medium",
      source: "ai",
      rationale: "Expressed in diplomacy but traded away in practice",
      revision: 1,
      stale: false,
    },
  ],
  relationships: [
    {
      id: "rel-1",
      type: "has-objective",
      fromEntityId: "player-a",
      toEntityId: "obj-a1",
    },
    {
      id: "rel-2",
      type: "has-objective",
      fromEntityId: "player-a",
      toEntityId: "obj-a2",
    },
    {
      id: "rel-3",
      type: "conflicts-with",
      fromEntityId: "obj-a1",
      toEntityId: "obj-a2",
    },
  ],
});

const VALID_PHASE_3_OUTPUT = JSON.stringify({
  entities: [
    {
      id: "game-1",
      type: "game",
      phase: "baseline-model",
      data: {
        type: "game",
        name: "Steel Trade War",
        gameType: "chicken",
        timing: "sequential",
        description:
          "Both countries escalate tariffs, each hoping the other backs down first",
      },
      position: { x: 0, y: 0 },
      confidence: "medium",
      source: "ai",
      rationale:
        "Mutual escalation with asymmetric costs fits chicken structure",
      revision: 1,
      stale: false,
    },
    {
      id: "strat-a1",
      type: "strategy",
      phase: "baseline-model",
      data: {
        type: "strategy",
        name: "Maintain tariffs",
        feasibility: "actual",
        description: "Keep current tariff levels in place",
      },
      position: { x: 0, y: 0 },
      confidence: "high",
      source: "ai",
      rationale: "Already enacted, no new authority needed",
      revision: 1,
      stale: false,
    },
    {
      id: "strat-a2",
      type: "strategy",
      phase: "baseline-model",
      data: {
        type: "strategy",
        name: "Escalate to all imports",
        feasibility: "requires-new-capability",
        description: "Extend tariffs to all Country B imports",
      },
      position: { x: 0, y: 0 },
      confidence: "medium",
      source: "ai",
      rationale: "Requires legislative approval",
      revision: 1,
      stale: false,
    },
  ],
  relationships: [
    {
      id: "rel-1",
      type: "plays-in",
      fromEntityId: "player-a",
      toEntityId: "game-1",
    },
    {
      id: "rel-2",
      type: "has-strategy",
      fromEntityId: "player-a",
      toEntityId: "strat-a1",
    },
    {
      id: "rel-3",
      type: "has-strategy",
      fromEntityId: "player-a",
      toEntityId: "strat-a2",
    },
  ],
});

// ── Tests ──

describe("phase worker", () => {
  describe("phase 1 — situational grounding", () => {
    it("parses valid Phase 1 output into Fact entities", () => {
      const result = phase1Worker.parseResponse(VALID_PHASE_1_OUTPUT);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.entities).toHaveLength(2);
      expect(result.data.entities[0].type).toBe("fact");
      expect(result.data.entities[0].data.type).toBe("fact");
      expect(result.data.entities[0].id).toBe("fact-1");
      expect(result.data.entities[1].confidence).toBe("medium");

      expect(result.data.relationships).toHaveLength(1);
      expect(result.data.relationships[0].type).toBe("precedes");
    });

    it("parses Phase 1 output wrapped in a code fence", () => {
      const fenced =
        "Here is the analysis:\n```json\n" + VALID_PHASE_1_OUTPUT + "\n```\n";
      const result = phase1Worker.parseResponse(fenced);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.entities).toHaveLength(2);
    });

    it("builds a prompt with topic and optional prior context", () => {
      const { system, user } = phase1Worker.buildPrompt("US-China trade war");
      expect(system).toContain("Phase 1");
      expect(system).toContain("Situational Grounding");
      expect(user).toContain("US-China trade war");
      expect(user).not.toContain("Prior phase");

      const { user: userWithCtx } = phase1Worker.buildPrompt(
        "US-China trade war",
        '{"entities":[]}',
      );
      expect(userWithCtx).toContain("Prior phase output");
    });
  });

  describe("phase 2 — player identification", () => {
    it("parses valid Phase 2 output into Player and Objective entities", () => {
      const result = phase2Worker.parseResponse(VALID_PHASE_2_OUTPUT);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.entities).toHaveLength(3);

      const player = result.data.entities.find((e) => e.type === "player");
      expect(player).toBeDefined();
      expect(player!.data.type).toBe("player");

      const objectives = result.data.entities.filter(
        (e) => e.type === "objective",
      );
      expect(objectives).toHaveLength(2);

      expect(result.data.relationships).toHaveLength(3);
      expect(
        result.data.relationships.filter((r) => r.type === "has-objective"),
      ).toHaveLength(2);
    });
  });

  describe("phase 3 — baseline model", () => {
    it("parses valid Phase 3 output into Game and Strategy entities", () => {
      const result = phase3Worker.parseResponse(VALID_PHASE_3_OUTPUT);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.entities).toHaveLength(3);

      const game = result.data.entities.find((e) => e.type === "game");
      expect(game).toBeDefined();
      expect(game!.data.type).toBe("game");

      const strategies = result.data.entities.filter(
        (e) => e.type === "strategy",
      );
      expect(strategies).toHaveLength(2);

      expect(result.data.relationships).toHaveLength(3);
    });
  });

  describe("error handling", () => {
    it("returns error for malformed JSON", () => {
      const result = phase1Worker.parseResponse("{ not valid json }}}");
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain("Invalid JSON");
    });

    it("returns error for empty response", () => {
      const result = phase1Worker.parseResponse("");
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe("Empty response");
    });

    it("returns error for whitespace-only response", () => {
      const result = phase1Worker.parseResponse("   \n  ");
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe("Empty response");
    });

    it("returns error when entities array is missing", () => {
      const result = phase1Worker.parseResponse(
        JSON.stringify({ relationships: [] }),
      );
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain("entities");
    });

    it("returns error when relationships array is missing", () => {
      const result = phase1Worker.parseResponse(
        JSON.stringify({ entities: [] }),
      );
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain("relationships");
    });

    it("returns error for wrong entity types (Zod validation fails)", () => {
      // Feed Phase 2 entities (player) to Phase 1 worker (expects fact)
      const result = phase1Worker.parseResponse(VALID_PHASE_2_OUTPUT);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toMatch(/Entity 0/);
    });

    it("returns error for a Phase 3 entity missing required fields", () => {
      const badOutput = JSON.stringify({
        entities: [
          {
            id: "game-1",
            type: "game",
            phase: "baseline-model",
            data: {
              type: "game",
              name: "", // empty name fails min(1)
              gameType: "chicken",
              timing: "simultaneous",
            },
            position: { x: 0, y: 0 },
            confidence: "high",
            source: "ai",
            rationale: "test",
            revision: 1,
            stale: false,
          },
        ],
        relationships: [],
      });
      const result = phase3Worker.parseResponse(badOutput);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toMatch(/Entity 0/);
    });

    it("returns error for invalid relationship type", () => {
      const badOutput = JSON.stringify({
        entities: [],
        relationships: [
          {
            id: "rel-1",
            type: "invalid-type",
            fromEntityId: "a",
            toEntityId: "b",
          },
        ],
      });
      const result = phase1Worker.parseResponse(badOutput);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toMatch(/Relationship 0/);
    });
  });

  describe("createPhaseWorker factory", () => {
    it("creates workers for all three phases", () => {
      const w1 = createPhaseWorker("situational-grounding");
      const w2 = createPhaseWorker("player-identification");
      const w3 = createPhaseWorker("baseline-model");

      expect(w1.phase).toBe("situational-grounding");
      expect(w2.phase).toBe("player-identification");
      expect(w3.phase).toBe("baseline-model");
    });

    it("pre-configured instances match their phases", () => {
      expect(phase1Worker.phase).toBe("situational-grounding");
      expect(phase2Worker.phase).toBe("player-identification");
      expect(phase3Worker.phase).toBe("baseline-model");
    });
  });

  describe("trailing comma tolerance", () => {
    it("handles trailing commas in JSON", () => {
      const withTrailing = `{
        "entities": [
          {
            "id": "fact-1",
            "type": "fact",
            "phase": "situational-grounding",
            "data": {
              "type": "fact",
              "date": "2025-01-01",
              "source": "Test",
              "content": "Test fact",
              "category": "action",
            },
            "position": { "x": 0, "y": 0 },
            "confidence": "high",
            "source": "ai",
            "rationale": "Test",
            "revision": 1,
            "stale": false,
          },
        ],
        "relationships": [],
      }`;
      const result = phase1Worker.parseResponse(withTrailing);
      expect(result.success).toBe(true);
    });
  });
});
