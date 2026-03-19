import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Fixtures ──

const VALID_PHASE_1_STRUCTURED = {
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
};

const VALID_PHASE_2_STRUCTURED = {
  entities: [
    {
      id: "player-a",
      type: "player",
      phase: "player-identification",
      data: {
        type: "player",
        name: "Country A",
        playerType: "primary",
        knowledge: ["Own tariff schedule"],
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
      rationale: "Stated policy goal",
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
  ],
};

const VALID_PHASE_3_STRUCTURED = {
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
        description: "Escalation game between two trading nations",
      },
      position: { x: 0, y: 0 },
      confidence: "medium",
      source: "ai",
      rationale: "Fits chicken structure",
      revision: 1,
      stale: false,
    },
  ],
  relationships: [],
};

// ── Mock adapters ──

const mockClaudeAdapter = {
  runAnalysisPhase: vi.fn(),
};

const mockCodexAdapter = {
  runAnalysisPhase: vi.fn(),
};

vi.mock("@/services/ai/claude-adapter", () => mockClaudeAdapter);
vi.mock("@/services/ai/codex-adapter", () => mockCodexAdapter);

// ── Tests ──

describe("analysis-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Lazy-import to ensure mocks are active
  async function importService() {
    return import("@/services/ai/analysis-service");
  }

  describe("runPhase", () => {
    it("builds correct prompt and calls adapter for situational-grounding", async () => {
      mockClaudeAdapter.runAnalysisPhase.mockResolvedValue(
        VALID_PHASE_1_STRUCTURED,
      );

      const { runPhase } = await importService();
      const result = await runPhase(
        "situational-grounding",
        "US-China trade war",
      );

      expect(mockClaudeAdapter.runAnalysisPhase).toHaveBeenCalledTimes(1);
      const [prompt, systemPrompt, model, schema] =
        mockClaudeAdapter.runAnalysisPhase.mock.calls[0];

      // Prompt contains the topic
      expect(prompt).toContain("US-China trade war");
      // System prompt is the phase 1 prompt
      expect(systemPrompt).toContain("Phase 1");
      expect(systemPrompt).toContain("Situational Grounding");
      // Model defaults
      expect(model).toBe("claude-sonnet-4-20250514");
      // Schema is a JSON schema object
      expect(schema).toHaveProperty("type", "object");
      expect(schema).toHaveProperty("required");

      expect(result.success).toBe(true);
    });

    it("returns entities and relationships on success", async () => {
      mockClaudeAdapter.runAnalysisPhase.mockResolvedValue(
        VALID_PHASE_1_STRUCTURED,
      );

      const { runPhase } = await importService();
      const result = await runPhase(
        "situational-grounding",
        "US-China trade war",
      );

      expect(result.success).toBe(true);
      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].type).toBe("fact");
      expect(result.entities[0].id).toBe("fact-1");
      expect(result.entities[1].confidence).toBe("medium");
      expect(result.relationships).toHaveLength(1);
      expect(result.relationships[0].type).toBe("precedes");
      expect(result.error).toBeUndefined();
    });

    it("validates response against Zod schema — rejects wrong entity types", async () => {
      // Feed phase 2 entities to phase 1
      mockClaudeAdapter.runAnalysisPhase.mockResolvedValue(
        VALID_PHASE_2_STRUCTURED,
      );

      const { runPhase } = await importService();
      const result = await runPhase(
        "situational-grounding",
        "US-China trade war",
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Entity 0/);
      expect(result.entities).toHaveLength(0);
    });

    it("falls back to text parsing when structured output returns raw text", async () => {
      // Adapter returns a raw JSON string instead of parsed object
      mockClaudeAdapter.runAnalysisPhase.mockResolvedValue(
        JSON.stringify(VALID_PHASE_1_STRUCTURED),
      );

      const { runPhase } = await importService();
      const result = await runPhase(
        "situational-grounding",
        "US-China trade war",
      );

      expect(result.success).toBe(true);
      expect(result.entities).toHaveLength(2);
      expect(result.relationships).toHaveLength(1);
    });

    it("falls back to text parsing for code-fenced text response", async () => {
      const fenced =
        "Here is the analysis:\n```json\n" +
        JSON.stringify(VALID_PHASE_1_STRUCTURED) +
        "\n```\n";
      mockClaudeAdapter.runAnalysisPhase.mockResolvedValue(fenced);

      const { runPhase } = await importService();
      const result = await runPhase(
        "situational-grounding",
        "US-China trade war",
      );

      expect(result.success).toBe(true);
      expect(result.entities).toHaveLength(2);
    });

    it("returns { success: false, error } on adapter error", async () => {
      mockClaudeAdapter.runAnalysisPhase.mockRejectedValue(
        new Error("API rate limit exceeded"),
      );

      const { runPhase } = await importService();
      const result = await runPhase(
        "situational-grounding",
        "US-China trade war",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("API rate limit exceeded");
      expect(result.entities).toHaveLength(0);
      expect(result.relationships).toHaveLength(0);
    });

    it("includes prior context in prompt when provided", async () => {
      mockClaudeAdapter.runAnalysisPhase.mockResolvedValue(
        VALID_PHASE_2_STRUCTURED,
      );

      const priorEntities = JSON.stringify({
        entities: VALID_PHASE_1_STRUCTURED.entities,
      });

      const { runPhase } = await importService();
      await runPhase("player-identification", "US-China trade war", {
        priorEntities,
      });

      const [prompt] = mockClaudeAdapter.runAnalysisPhase.mock.calls[0];
      expect(prompt).toContain("Prior phase output");
      expect(prompt).toContain(priorEntities);
    });

    it("does NOT retry on failure (returns failure to caller)", async () => {
      mockClaudeAdapter.runAnalysisPhase.mockRejectedValue(
        new Error("Network error"),
      );

      const { runPhase } = await importService();
      const result = await runPhase(
        "situational-grounding",
        "US-China trade war",
      );

      // Only called once — no retry
      expect(mockClaudeAdapter.runAnalysisPhase).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });

    it("returns error for unsupported phase", async () => {
      const { runPhase } = await importService();
      const result = await runPhase("historical-game", "US-China trade war");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unsupported phase");
      expect(mockClaudeAdapter.runAnalysisPhase).not.toHaveBeenCalled();
    });

    it("uses openai adapter when provider is openai", async () => {
      mockCodexAdapter.runAnalysisPhase.mockResolvedValue(
        VALID_PHASE_1_STRUCTURED,
      );

      const { runPhase } = await importService();
      const result = await runPhase(
        "situational-grounding",
        "US-China trade war",
        { provider: "openai" },
      );

      expect(mockCodexAdapter.runAnalysisPhase).toHaveBeenCalledTimes(1);
      expect(mockClaudeAdapter.runAnalysisPhase).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("uses custom model when provided in context", async () => {
      mockClaudeAdapter.runAnalysisPhase.mockResolvedValue(
        VALID_PHASE_1_STRUCTURED,
      );

      const { runPhase } = await importService();
      await runPhase("situational-grounding", "test topic", {
        model: "claude-opus-4-20250514",
      });

      const [, , model] = mockClaudeAdapter.runAnalysisPhase.mock.calls[0];
      expect(model).toBe("claude-opus-4-20250514");
    });

    it("works for phase 2 — player identification", async () => {
      mockClaudeAdapter.runAnalysisPhase.mockResolvedValue(
        VALID_PHASE_2_STRUCTURED,
      );

      const { runPhase } = await importService();
      const result = await runPhase(
        "player-identification",
        "US-China trade war",
      );

      expect(result.success).toBe(true);
      expect(result.entities).toHaveLength(2);

      const player = result.entities.find((e) => e.type === "player");
      expect(player).toBeDefined();
      expect(player!.data.type).toBe("player");

      const objective = result.entities.find((e) => e.type === "objective");
      expect(objective).toBeDefined();

      const [, systemPrompt] = mockClaudeAdapter.runAnalysisPhase.mock.calls[0];
      expect(systemPrompt).toContain("Phase 2");
      expect(systemPrompt).toContain("Player Identification");
    });

    it("works for phase 3 — baseline model", async () => {
      mockClaudeAdapter.runAnalysisPhase.mockResolvedValue(
        VALID_PHASE_3_STRUCTURED,
      );

      const { runPhase } = await importService();
      const result = await runPhase("baseline-model", "US-China trade war");

      expect(result.success).toBe(true);
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].type).toBe("game");

      const [, systemPrompt] = mockClaudeAdapter.runAnalysisPhase.mock.calls[0];
      expect(systemPrompt).toContain("Phase 3");
      expect(systemPrompt).toContain("Baseline Strategic Model");
    });

    it("returns validation error for invalid relationship type in structured output", async () => {
      const badOutput = {
        entities: [],
        relationships: [
          {
            id: "rel-1",
            type: "invalid-type",
            fromEntityId: "a",
            toEntityId: "b",
          },
        ],
      };
      mockClaudeAdapter.runAnalysisPhase.mockResolvedValue(badOutput);

      const { runPhase } = await importService();
      const result = await runPhase("situational-grounding", "test topic");

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Relationship 0/);
    });

    it("returns validation error for empty text fallback", async () => {
      mockClaudeAdapter.runAnalysisPhase.mockResolvedValue("");

      const { runPhase } = await importService();
      const result = await runPhase("situational-grounding", "test topic");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Empty response");
    });

    it("returns validation error for invalid JSON in text fallback", async () => {
      mockClaudeAdapter.runAnalysisPhase.mockResolvedValue(
        "{ not valid json }}}",
      );

      const { runPhase } = await importService();
      const result = await runPhase("situational-grounding", "test topic");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid JSON");
    });
  });

  describe("_buildPrompt", () => {
    it("builds prompt without prior context", async () => {
      const { _buildPrompt } = await importService();
      const { system, user } = _buildPrompt(
        "situational-grounding",
        "US-China trade war",
      );

      expect(system).toContain("Phase 1");
      expect(user).toContain("US-China trade war");
      expect(user).not.toContain("Prior phase");
    });

    it("builds prompt with prior context", async () => {
      const { _buildPrompt } = await importService();
      const { user } = _buildPrompt(
        "player-identification",
        "US-China trade war",
        '{"entities":[]}',
      );

      expect(user).toContain("Prior phase output");
      expect(user).toContain('{"entities":[]}');
    });
  });

  describe("_parseTextResponse", () => {
    it("parses valid JSON text", async () => {
      const { _parseTextResponse } = await importService();
      const result = _parseTextResponse(
        JSON.stringify(VALID_PHASE_1_STRUCTURED),
        "situational-grounding",
      );

      expect(result.success).toBe(true);
      expect(result.entities).toHaveLength(2);
    });

    it("handles trailing commas in JSON", async () => {
      const { _parseTextResponse } = await importService();
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
      const result = _parseTextResponse(withTrailing, "situational-grounding");
      expect(result.success).toBe(true);
    });
  });

  describe("_validatePhaseOutput", () => {
    it("rejects non-object input", async () => {
      const { _validatePhaseOutput } = await importService();
      const result = _validatePhaseOutput([1, 2, 3], "situational-grounding");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not a JSON object");
    });

    it("rejects missing entities array", async () => {
      const { _validatePhaseOutput } = await importService();
      const result = _validatePhaseOutput(
        { relationships: [] },
        "situational-grounding",
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("entities");
    });

    it("rejects missing relationships array", async () => {
      const { _validatePhaseOutput } = await importService();
      const result = _validatePhaseOutput(
        { entities: [] },
        "situational-grounding",
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("relationships");
    });
  });
});
