import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Fixtures ──

const VALID_PHASE_1_STRUCTURED = {
  entities: [
    {
      id: null,
      ref: "fact-1",
      type: "fact",
      phase: "situational-grounding",
      data: {
        type: "fact",
        date: "2025-06-15",
        source: "Reuters",
        content: "Country A imposed 25% tariffs on Country B steel imports",
        category: "action",
      },
      confidence: "high",
      rationale: "Confirmed by official trade records",
    },
    {
      id: null,
      ref: "fact-2",
      type: "fact",
      phase: "situational-grounding",
      data: {
        type: "fact",
        date: "2025-06-20",
        source: "Bloomberg",
        content: "Country B steel exports dropped 40% in the first week",
        category: "economic",
      },
      confidence: "medium",
      rationale: "Early data, may be revised",
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
      id: null,
      ref: "player-a",
      type: "player",
      phase: "player-identification",
      data: {
        type: "player",
        name: "Country A",
        playerType: "primary",
        knowledge: ["Own tariff schedule"],
      },
      confidence: "high",
      rationale: "Initiator of the tariff action",
    },
    {
      id: null,
      ref: "obj-a1",
      type: "objective",
      phase: "player-identification",
      data: {
        type: "objective",
        description: "Protect domestic steel industry",
        priority: "high",
        stability: "stable",
      },
      confidence: "high",
      rationale: "Stated policy goal",
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
      id: null,
      ref: "game-1",
      type: "game",
      phase: "baseline-model",
      data: {
        type: "game",
        name: "Steel Trade War",
        gameType: "chicken",
        timing: "sequential",
        description: "Escalation game between two trading nations",
      },
      confidence: "medium",
      rationale: "Fits chicken structure",
    },
  ],
  relationships: [],
};

const VALID_PHASE_4_STRUCTURED = {
  entities: [
    {
      id: null,
      ref: "history-1",
      type: "interaction-history",
      phase: "historical-game",
      data: {
        type: "interaction-history",
        playerPair: ["Country A", "Country B"],
        moves: [
          {
            actor: "Country A",
            action: "defection",
            description: "Imposed 10% tariffs on steel",
            date: "2022-03-01",
            otherSideAction: "Cooperative trade policy",
            outcome: "Trade tensions increased",
            beliefChange: "Country B views A as aggressive",
          },
        ],
        timespan: "2020-2025",
      },
      confidence: "high",
      rationale: "Documented trade history",
    },
    {
      id: null,
      ref: "pattern-1",
      type: "repeated-game-pattern",
      phase: "historical-game",
      data: {
        type: "repeated-game-pattern",
        patternType: "tit-for-tat",
        description: "Retaliatory tariff escalation",
        evidence: "Each round of tariffs met with counter-tariffs",
        frequency: "Every 6 months since 2022",
      },
      confidence: "high",
      rationale: "Clear pattern of retaliation",
    },
    {
      id: null,
      ref: "trust-1",
      type: "trust-assessment",
      phase: "historical-game",
      data: {
        type: "trust-assessment",
        playerPair: ["Country A", "Country B"],
        trustLevel: "low",
        direction: "Mutual distrust",
        evidence: "Repeated defections and broken agreements",
        implication: "Cooperation unlikely without enforcement",
      },
      confidence: "medium",
      rationale: "Track record of broken commitments",
    },
    {
      id: null,
      ref: "commitment-1",
      type: "dynamic-inconsistency",
      phase: "historical-game",
      data: {
        type: "dynamic-inconsistency",
        commitment: "Free trade agreement",
        institutionalForm: "treaty-ratified",
        durability: "fragile",
        transitionRisk: "New administration may withdraw",
        timeHorizon: "2-4 years",
      },
      confidence: "medium",
      rationale: "Political transition risk",
    },
    {
      id: null,
      ref: "signal-1",
      type: "signaling-effect",
      phase: "historical-game",
      data: {
        type: "signaling-effect",
        signal: "Country A imposed tariffs despite WTO ruling",
        observers: ["EU", "Japan", "South Korea"],
        lesson: "WTO enforcement is weak",
        reputationEffect: "A seen as unilateral actor",
      },
      confidence: "high",
      rationale: "Major signal to global trade community",
    },
  ],
  relationships: [
    {
      id: "rel-h1",
      type: "derived-from",
      fromEntityId: "pattern-1",
      toEntityId: "history-1",
    },
  ],
};

const VALID_PHASE_6_STRUCTURED = {
  entities: [
    {
      id: null,
      ref: "matrix-1",
      type: "payoff-matrix",
      phase: "formal-modeling",
      data: {
        type: "payoff-matrix",
        gameName: "Steel Trade War",
        players: ["Country A", "Country B"],
        strategies: {
          row: ["Escalate", "Negotiate"],
          column: ["Retaliate", "Concede"],
        },
        cells: [
          {
            row: "Escalate",
            column: "Retaliate",
            payoffs: [
              {
                player: "Country A",
                ordinalRank: 3,
                cardinalValue: null,
                rangeLow: -20,
                rangeHigh: -5,
                confidence: "medium",
                rationale: "Both lose from escalation",
                dependencies: ["game-1"],
              },
              {
                player: "Country B",
                ordinalRank: 3,
                cardinalValue: null,
                rangeLow: -25,
                rangeHigh: -10,
                confidence: "medium",
                rationale: "Smaller economy bears larger cost",
                dependencies: ["fact-2"],
              },
            ],
          },
        ],
      },
      confidence: "medium",
      rationale: "Normal-form representation of simultaneous tariff game",
    },
    {
      id: null,
      ref: "tree-1",
      type: "game-tree",
      phase: "formal-modeling",
      data: {
        type: "game-tree",
        gameName: "Tariff Escalation Sequence",
        nodes: [
          {
            nodeId: "n1",
            player: "Country A",
            nodeType: "decision",
            informationSet: null,
          },
          {
            nodeId: "n2",
            player: "Country B",
            nodeType: "decision",
            informationSet: null,
          },
          {
            nodeId: "n3",
            player: null,
            nodeType: "terminal",
            informationSet: null,
          },
        ],
        branches: [
          {
            fromNodeId: "n1",
            toNodeId: "n2",
            action: "Impose tariffs",
            probability: null,
          },
          {
            fromNodeId: "n2",
            toNodeId: "n3",
            action: "Retaliate",
            probability: null,
          },
        ],
        informationSets: [],
        terminalPayoffs: [
          {
            nodeId: "n3",
            payoffs: [
              {
                player: "Country A",
                ordinalRank: 3,
                cardinalValue: null,
                rangeLow: -15,
                rangeHigh: -5,
                confidence: "medium",
                rationale: "Mutual escalation outcome",
                dependencies: ["game-1"],
              },
            ],
          },
        ],
      },
      confidence: "medium",
      rationale: "Sequential representation of tariff escalation",
    },
    {
      id: null,
      ref: "equil-1",
      type: "equilibrium-result",
      phase: "formal-modeling",
      data: {
        type: "equilibrium-result",
        gameName: "Steel Trade War",
        equilibriumType: "nash",
        description: "Both countries escalate in the absence of enforcement",
        strategies: [
          { player: "Country A", strategy: "Escalate" },
          { player: "Country B", strategy: "Retaliate" },
        ],
        selectionFactors: [
          {
            factor: "path-dependence",
            evidence:
              "Prior rounds of escalation make cooperation focal point unattainable",
            weight: "high",
          },
        ],
      },
      confidence: "medium",
      rationale: "Dominant strategy equilibrium given low trust",
    },
    {
      id: null,
      ref: "constraint-1",
      type: "cross-game-constraint-table",
      phase: "formal-modeling",
      data: {
        type: "cross-game-constraint-table",
        strategies: ["Full escalation", "Selective tariffs"],
        games: ["Steel Trade War", "Tech Competition"],
        cells: [
          {
            strategy: "Full escalation",
            game: "Steel Trade War",
            result: "pass",
            reasoning: "Feasible given existing authority",
          },
          {
            strategy: "Full escalation",
            game: "Tech Competition",
            result: "fail",
            reasoning: "Would trigger semiconductor retaliation",
          },
        ],
      },
      confidence: "medium",
      rationale: "Cross-game strategy feasibility check",
    },
    {
      id: null,
      ref: "effect-1",
      type: "cross-game-effect",
      phase: "formal-modeling",
      data: {
        type: "cross-game-effect",
        sourceGame: "Steel Trade War",
        targetGame: "Tech Competition",
        trigger: "Escalation beyond 50% tariffs",
        effectType: "payoff-shift",
        magnitude: "Large negative shift in tech cooperation payoffs",
        direction: "Reduces cooperation incentives",
        cascade: true,
      },
      confidence: "medium",
      rationale: "Steel escalation spills over into tech sector",
    },
    {
      id: null,
      ref: "signal-cls-1",
      type: "signal-classification",
      phase: "formal-modeling",
      data: {
        type: "signal-classification",
        action: "Country A public tariff announcement",
        player: "Country A",
        classification: "audience-cost",
        cheapTalkConditions: null,
        credibility: "high",
      },
      confidence: "high",
      rationale: "Public announcement creates domestic audience costs",
    },
    {
      id: null,
      ref: "bargain-1",
      type: "bargaining-dynamics",
      phase: "formal-modeling",
      data: {
        type: "bargaining-dynamics",
        negotiation: "Steel tariff negotiations",
        outsideOptions: [
          {
            player: "Country A",
            option: "Domestic production subsidy",
            quality: "moderate",
          },
        ],
        patience: [
          {
            player: "Country A",
            discountFactor: "Low — election cycle pressure",
            pressures: ["Upcoming election", "Domestic industry lobbying"],
          },
        ],
        deadlines: [
          {
            description: "WTO dispute ruling",
            date: "2026-06-01",
            affectsPlayer: "Country A",
          },
        ],
        commitmentProblems: ["Post-election policy reversal"],
        dynamicInconsistency: "New administration may reverse tariffs",
        issueLinkage: [
          {
            linkedGame: "Tech Competition",
            description: "Steel concessions may be traded for tech access",
          },
        ],
      },
      confidence: "medium",
      rationale: "Bargaining dynamics driven by asymmetric patience",
    },
    {
      id: null,
      ref: "optval-1",
      type: "option-value-assessment",
      phase: "formal-modeling",
      data: {
        type: "option-value-assessment",
        player: "Country B",
        action: "Retaliatory tariffs on agriculture",
        flexibilityPreserved: [
          {
            type: "waiting-for-information",
            description: "Election outcome may change Country A's position",
          },
        ],
        uncertaintyLevel: "high",
      },
      confidence: "medium",
      rationale: "Delay preserves option value given political uncertainty",
    },
    {
      id: null,
      ref: "behav-1",
      type: "behavioral-overlay",
      phase: "formal-modeling",
      data: {
        type: "behavioral-overlay",
        classification: "adjacent",
        overlayType: "sunk-cost",
        description:
          "Country A has invested political capital in tariff policy",
        affectedPlayers: ["Country A"],
        referencePoint: "Pre-tariff trade levels",
        predictionModification:
          "Country A less likely to de-escalate than rational model predicts due to sunk political costs",
      },
      confidence: "medium",
      rationale: "Sunk cost bias may prevent rational de-escalation",
    },
  ],
  relationships: [
    {
      id: "rel-f1",
      type: "derived-from",
      fromEntityId: "matrix-1",
      toEntityId: "game-1",
    },
    {
      id: "rel-f2",
      type: "depends-on",
      fromEntityId: "effect-1",
      toEntityId: "matrix-1",
    },
  ],
};

const VALID_PHASE_7_STRUCTURED = {
  entities: [
    {
      id: null,
      ref: "assumption-1",
      type: "assumption",
      phase: "assumptions",
      data: {
        type: "assumption",
        description: "Both players are rational utility maximizers",
        sensitivity: "critical",
        category: "rationality",
        classification: "game-theoretic",
        correlatedClusterId: "cluster-rationality",
        rationale: "Foundation of all game-theoretic predictions",
        dependencies: ["game-1", "player-a"],
      },
      confidence: "medium",
      rationale: "Standard assumption but may not hold under domestic pressure",
    },
    {
      id: null,
      ref: "assumption-2",
      type: "assumption",
      phase: "assumptions",
      data: {
        type: "assumption",
        description: "Steel tariffs are the primary trade friction",
        sensitivity: "high",
        category: "structural",
        classification: "empirical",
        correlatedClusterId: null,
        rationale: "Other sectors may also be significant",
        dependencies: ["fact-1"],
      },
      confidence: "high",
      rationale: "Directly observable from trade data",
    },
  ],
  relationships: [],
};

// ── Mock adapters ──

const mockClaudeRunAnalysisPhase = vi.fn();
const mockCodexRunAnalysisPhase = vi.fn();

vi.mock("../ai/adapter-contract", () => ({
  getRuntimeAdapter: vi.fn(async (providerInput?: string) => {
    if (
      providerInput
      && providerInput !== "anthropic"
      && providerInput !== "claude"
      && providerInput !== "openai"
      && providerInput !== "codex"
    ) {
      throw new Error(`Unknown provider: ${providerInput}`);
    }
    const isCodex = providerInput === "openai" || providerInput === "codex";
    const runStructuredTurn = isCodex
      ? mockCodexRunAnalysisPhase
      : mockClaudeRunAnalysisPhase;
    return {
      provider: isCodex ? "codex" : "claude",
      createSession(key: { ownerId: string; runId?: string }) {
        return {
          provider: isCodex ? "codex" : "claude",
          key,
          streamChatTurn: vi.fn(),
          runStructuredTurn<T = unknown>(input: {
            prompt: string;
            systemPrompt: string;
            model: string;
            schema: Record<string, unknown>;
            maxTurns?: number;
            runId?: string;
            signal?: AbortSignal;
            webSearch?: boolean;
            onActivity?: unknown;
          }) {
            return runStructuredTurn(
              input.prompt,
              input.systemPrompt,
              input.model,
              input.schema,
              {
                signal: input.signal,
                runId: input.runId,
                maxTurns: input.maxTurns,
                webSearch: input.webSearch,
                onActivity: input.onActivity,
              },
            ) as Promise<T>;
          },
          getDiagnostics: vi.fn(() => ({
            provider: isCodex ? "codex" : "claude",
            sessionId: "test-analysis-service-session",
            details: { ownerId: key.ownerId },
          })),
          dispose: vi.fn(async () => {}),
        };
      },
      listModels: vi.fn(async () => []),
      checkHealth: vi.fn(async () => ({
        provider: isCodex ? "codex" : "claude",
        status: "healthy",
        reason: null,
        checkedAt: Date.now(),
        checks: [],
      })),
    };
  }),
}));

// ── Tests ──

describe("analysis-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Lazy-import to ensure mocks are active
  async function importService() {
    return import("../analysis-service");
  }

  describe("runPhase", () => {
    it("builds correct prompt and calls adapter for situational-grounding", async () => {
      mockClaudeRunAnalysisPhase.mockResolvedValue(VALID_PHASE_1_STRUCTURED);

      const { runPhase } = await importService();
      const result = await runPhase(
        "situational-grounding",
        "US-China trade war",
      );

      expect(mockClaudeRunAnalysisPhase).toHaveBeenCalledTimes(1);
      const [prompt, systemPrompt, model, schema, options] =
        mockClaudeRunAnalysisPhase.mock.calls[0];

      // Prompt contains the topic
      expect(prompt).toContain("US-China trade war");
      // System prompt is the phase 1 prompt
      expect(systemPrompt).toContain("Phase 1");
      expect(systemPrompt).toContain("Situational Grounding");
      // Model defaults
      expect(model).toBe("claude-sonnet-4-20250514");
      // Schema is a real JSON schema with entity-specific fields (not placeholder)
      expect(schema).toHaveProperty("type", "object");
      expect(schema).toHaveProperty("required");
      // entities.items should have real schema fields, not just { type: "object" }
      const entityItems = (schema as any).properties.entities.items;
      expect(entityItems).toHaveProperty("properties");
      expect(entityItems.properties).toHaveProperty("type");
      expect(entityItems.properties).toHaveProperty("data");
      // Relationship items should have typed enum
      const relItems = (schema as any).properties.relationships.items;
      expect(relItems.properties.type.enum).toContain("supports");
      expect(relItems.properties.type.enum).toContain("precedes");
      expect(options).toEqual(
        expect.objectContaining({
          signal: undefined,
          runId: undefined,
          webSearch: undefined,
        }),
      );

      expect(result.success).toBe(true);
    });

    it("returns entities and relationships on success", async () => {
      mockClaudeRunAnalysisPhase.mockResolvedValue(VALID_PHASE_1_STRUCTURED);

      const { runPhase } = await importService();
      const result = await runPhase(
        "situational-grounding",
        "US-China trade war",
      );

      expect(result.success).toBe(true);
      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].type).toBe("fact");
      expect(result.entities[0].id).toBeNull();
      expect(result.entities[0].ref).toBe("fact-1");
      expect(result.entities[1].confidence).toBe("medium");
      expect(result.relationships).toHaveLength(1);
      expect(result.relationships[0].type).toBe("precedes");
      expect(result.error).toBeUndefined();
    });

    it("validates response against Zod schema — rejects wrong entity types", async () => {
      // Feed phase 2 entities to phase 1
      mockClaudeRunAnalysisPhase.mockResolvedValue(VALID_PHASE_2_STRUCTURED);

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
      mockClaudeRunAnalysisPhase.mockResolvedValue(
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
      mockClaudeRunAnalysisPhase.mockResolvedValue(fenced);

      const { runPhase } = await importService();
      const result = await runPhase(
        "situational-grounding",
        "US-China trade war",
      );

      expect(result.success).toBe(true);
      expect(result.entities).toHaveLength(2);
    });

    it("returns { success: false, error } on adapter error", async () => {
      mockClaudeRunAnalysisPhase.mockRejectedValue(
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
      mockClaudeRunAnalysisPhase.mockResolvedValue(VALID_PHASE_2_STRUCTURED);

      const priorEntities = JSON.stringify({
        entities: VALID_PHASE_1_STRUCTURED.entities,
      });

      const { runPhase } = await importService();
      await runPhase("player-identification", "US-China trade war", {
        priorEntities,
      });

      const [prompt] = mockClaudeRunAnalysisPhase.mock.calls[0];
      expect(prompt).toContain("Prior phase output");
      expect(prompt).toContain(priorEntities);
    });

    it("does NOT retry on failure (returns failure to caller)", async () => {
      mockClaudeRunAnalysisPhase.mockRejectedValue(new Error("Network error"));

      const { runPhase } = await importService();
      const result = await runPhase(
        "situational-grounding",
        "US-China trade war",
      );

      // Only called once — no retry
      expect(mockClaudeRunAnalysisPhase).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });

    it("returns error for unsupported phase", async () => {
      const { runPhase } = await importService();
      const result = await runPhase("revalidation", "US-China trade war");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unsupported phase");
      expect(mockClaudeRunAnalysisPhase).not.toHaveBeenCalled();
    });

    it("passes provider through to the executor", async () => {
      mockCodexRunAnalysisPhase.mockResolvedValue(VALID_PHASE_1_STRUCTURED);

      const { runPhase } = await importService();
      const result = await runPhase(
        "situational-grounding",
        "US-China trade war",
        { provider: "openai" },
      );

      expect(mockCodexRunAnalysisPhase).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
    });

    it("passes runId and signal through to the adapter options", async () => {
      mockClaudeRunAnalysisPhase.mockResolvedValue(VALID_PHASE_1_STRUCTURED);

      const { runPhase } = await importService();
      const controller = new AbortController();

      await runPhase("situational-grounding", "US-China trade war", {
        runId: "run-42",
        signal: controller.signal,
      });

      const [, , , , options] = mockClaudeRunAnalysisPhase.mock.calls[0];
      expect(options).toEqual(
        expect.objectContaining({
          signal: controller.signal,
          runId: "run-42",
        }),
      );
    });

    it("forwards analysis activity callbacks to the adapter and emits synthetic milestones", async () => {
      const onActivity = vi.fn();

      mockClaudeRunAnalysisPhase.mockImplementation(
        async (_prompt, _systemPrompt, _model, _schema, options) => {
          options?.onActivity?.({
            kind: "tool",
            message: "Using query_entities",
            toolName: "query_entities",
          });
          return VALID_PHASE_1_STRUCTURED;
        },
      );

      const { runPhase } = await importService();
      const result = await runPhase("situational-grounding", "US-China trade war", {
        onActivity,
      });

      expect(result.success).toBe(true);
      const [, , , , options] = mockClaudeRunAnalysisPhase.mock.calls[0];
      expect(options).toEqual(
        expect.objectContaining({
          onActivity: expect.any(Function),
        }),
      );
      expect(onActivity).toHaveBeenCalledWith({
        kind: "note",
        message: "Preparing phase analysis",
      });
      expect(onActivity).toHaveBeenCalledWith({
        kind: "note",
        message: "Researching evidence",
      });
      expect(onActivity).toHaveBeenCalledWith({
        kind: "tool",
        message: "Using query_entities",
        toolName: "query_entities",
      });
      expect(onActivity).toHaveBeenCalledWith({
        kind: "note",
        message: "Synthesizing phase output",
      });
      expect(onActivity).toHaveBeenCalledWith({
        kind: "note",
        message: "Validating structured output",
      });
    });

    it("returns an explicit error for an unknown provider", async () => {
      const { runPhase } = await importService();
      const result = await runPhase(
        "situational-grounding",
        "US-China trade war",
        { provider: "copilot" },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown provider: copilot");
      expect(mockClaudeRunAnalysisPhase).not.toHaveBeenCalled();
      expect(mockCodexRunAnalysisPhase).not.toHaveBeenCalled();
    });

    it("uses custom model when provided in context", async () => {
      mockClaudeRunAnalysisPhase.mockResolvedValue(VALID_PHASE_1_STRUCTURED);

      const { runPhase } = await importService();
      await runPhase("situational-grounding", "test topic", {
        model: "claude-opus-4-20250514",
      });

      const [, , model] = mockClaudeRunAnalysisPhase.mock.calls[0];
      expect(model).toBe("claude-opus-4-20250514");
    });

    it("works for phase 2 — player identification", async () => {
      mockClaudeRunAnalysisPhase.mockResolvedValue(VALID_PHASE_2_STRUCTURED);

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

      const [, systemPrompt, , schema] =
        mockClaudeRunAnalysisPhase.mock.calls[0];
      expect(systemPrompt).toContain("Phase 2");
      expect(systemPrompt).toContain("Player Identification");

      // Phase 2 schema uses anyOf for player + objective entity types
      const entityItems = (schema as any).properties.entities.items;
      expect(entityItems).toHaveProperty("anyOf");
      expect(entityItems.anyOf).toHaveLength(2);
      expect(entityItems).not.toHaveProperty("oneOf");
    });

    it("works for phase 3 — baseline model", async () => {
      mockClaudeRunAnalysisPhase.mockResolvedValue(VALID_PHASE_3_STRUCTURED);

      const { runPhase } = await importService();
      const result = await runPhase("baseline-model", "US-China trade war");

      expect(result.success).toBe(true);
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].type).toBe("game");

      const [, systemPrompt, , schema] =
        mockClaudeRunAnalysisPhase.mock.calls[0];
      expect(systemPrompt).toContain("Phase 3");
      expect(systemPrompt).toContain("Baseline Strategic Model");

      const entityItems = (schema as any).properties.entities.items;
      expect(entityItems).toHaveProperty("anyOf");
      expect(entityItems.anyOf).toHaveLength(2);
      expect(entityItems).not.toHaveProperty("oneOf");
    });

    it("works for phase 4 — historical game", async () => {
      mockClaudeRunAnalysisPhase.mockResolvedValue(VALID_PHASE_4_STRUCTURED);

      const { runPhase } = await importService();
      const result = await runPhase("historical-game", "US-China trade war");

      expect(result.success).toBe(true);
      expect(result.entities).toHaveLength(5);

      const history = result.entities.find(
        (e) => e.type === "interaction-history",
      );
      expect(history).toBeDefined();
      expect(history!.data.type).toBe("interaction-history");

      const pattern = result.entities.find(
        (e) => e.type === "repeated-game-pattern",
      );
      expect(pattern).toBeDefined();

      const trust = result.entities.find((e) => e.type === "trust-assessment");
      expect(trust).toBeDefined();

      const commitment = result.entities.find(
        (e) => e.type === "dynamic-inconsistency",
      );
      expect(commitment).toBeDefined();

      const signal = result.entities.find((e) => e.type === "signaling-effect");
      expect(signal).toBeDefined();

      const [, systemPrompt, , schema] =
        mockClaudeRunAnalysisPhase.mock.calls[0];
      expect(systemPrompt).toContain("Phase 4");
      expect(systemPrompt).toContain("Historical Repeated Game");

      // Phase 4 schema uses anyOf for 5 entity types
      const entityItems = (schema as any).properties.entities.items;
      expect(entityItems).toHaveProperty("anyOf");
      expect(entityItems.anyOf).toHaveLength(5);
      expect(entityItems).not.toHaveProperty("oneOf");
    });

    it("works for phase 7 — assumptions", async () => {
      mockClaudeRunAnalysisPhase.mockResolvedValue(VALID_PHASE_7_STRUCTURED);

      const { runPhase } = await importService();
      const result = await runPhase("assumptions", "US-China trade war");

      expect(result.success).toBe(true);
      expect(result.entities).toHaveLength(2);

      const assumption = result.entities.find((e) => e.type === "assumption");
      expect(assumption).toBeDefined();
      expect(assumption!.data.type).toBe("assumption");

      const [, systemPrompt, , schema] =
        mockClaudeRunAnalysisPhase.mock.calls[0];
      expect(systemPrompt).toContain("Phase 7");
      expect(systemPrompt).toContain("Assumption");

      // Phase 7 schema uses a single entity type (no combinator)
      const entityItems = (schema as any).properties.entities.items;
      expect(entityItems).not.toHaveProperty("oneOf");
      expect(entityItems).not.toHaveProperty("anyOf");
      expect(entityItems.properties).toHaveProperty("type");
    });

    it("rejects phase 4 entities in phase 7 slot", async () => {
      mockClaudeRunAnalysisPhase.mockResolvedValue(VALID_PHASE_4_STRUCTURED);

      const { runPhase } = await importService();
      const result = await runPhase("assumptions", "US-China trade war");

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Entity 0/);
    });

    it("works for phase 6 — formal modeling", async () => {
      mockClaudeRunAnalysisPhase.mockResolvedValue(VALID_PHASE_6_STRUCTURED);

      const { runPhase } = await importService();
      const result = await runPhase("formal-modeling", "US-China trade war");

      expect(result.success).toBe(true);
      expect(result.entities).toHaveLength(9);

      const matrix = result.entities.find((e) => e.type === "payoff-matrix");
      expect(matrix).toBeDefined();
      expect(matrix!.data.type).toBe("payoff-matrix");

      const tree = result.entities.find((e) => e.type === "game-tree");
      expect(tree).toBeDefined();

      const equil = result.entities.find(
        (e) => e.type === "equilibrium-result",
      );
      expect(equil).toBeDefined();

      const constraint = result.entities.find(
        (e) => e.type === "cross-game-constraint-table",
      );
      expect(constraint).toBeDefined();

      const effect = result.entities.find(
        (e) => e.type === "cross-game-effect",
      );
      expect(effect).toBeDefined();

      const sigCls = result.entities.find(
        (e) => e.type === "signal-classification",
      );
      expect(sigCls).toBeDefined();

      const bargain = result.entities.find(
        (e) => e.type === "bargaining-dynamics",
      );
      expect(bargain).toBeDefined();

      const optVal = result.entities.find(
        (e) => e.type === "option-value-assessment",
      );
      expect(optVal).toBeDefined();

      const behav = result.entities.find(
        (e) => e.type === "behavioral-overlay",
      );
      expect(behav).toBeDefined();

      const [, systemPrompt, , schema] =
        mockClaudeRunAnalysisPhase.mock.calls[0];
      expect(systemPrompt).toContain("Phase 6");
      expect(systemPrompt).toContain("Formal Modeling");

      // Phase 6 schema uses anyOf for 9 entity types
      const entityItems = (schema as any).properties.entities.items;
      expect(entityItems).toHaveProperty("anyOf");
      expect(entityItems.anyOf).toHaveLength(9);
      expect(entityItems).not.toHaveProperty("oneOf");
    });

    it("uses anyOf for phase 9 — scenarios", async () => {
      mockClaudeRunAnalysisPhase.mockResolvedValue({
        entities: [],
        relationships: [],
      });

      const { runPhase } = await importService();
      const result = await runPhase("scenarios", "US-China trade war");

      expect(result.success).toBe(true);

      const [, systemPrompt, , schema] =
        mockClaudeRunAnalysisPhase.mock.calls[0];
      expect(systemPrompt).toContain("Phase 9");
      expect(systemPrompt).toContain("Scenario Generation");

      const entityItems = (schema as any).properties.entities.items;
      expect(entityItems).toHaveProperty("anyOf");
      expect(entityItems.anyOf).toHaveLength(2);
      expect(entityItems).not.toHaveProperty("oneOf");
    });

    it("rejects phase 6 entities in phase 7 slot", async () => {
      mockClaudeRunAnalysisPhase.mockResolvedValue(VALID_PHASE_6_STRUCTURED);

      const { runPhase } = await importService();
      const result = await runPhase("assumptions", "US-China trade war");

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Entity 0/);
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
      mockClaudeRunAnalysisPhase.mockResolvedValue(badOutput);

      const { runPhase } = await importService();
      const result = await runPhase("situational-grounding", "test topic");

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Relationship 0/);
    });

    it("returns validation error for empty text fallback", async () => {
      mockClaudeRunAnalysisPhase.mockResolvedValue("");

      const { runPhase } = await importService();
      const result = await runPhase("situational-grounding", "test topic");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Empty response");
    });

    it("returns validation error for invalid JSON in text fallback", async () => {
      mockClaudeRunAnalysisPhase.mockResolvedValue("{ not valid json }}}");

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
      expect(user).toContain("Use web search");
      expect(user).toContain(
        "get_entity, query_entities, and query_relationships",
      );
      expect(user).toContain("request_loopback");
      expect(user).toContain("Return only the final JSON object");
      expect(user).toContain('Effort level: "medium"');
      expect(user).toContain("Preserve the current expected level of depth");
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

    it("builds prompt with low effort guidance", async () => {
      const { _buildPrompt } = await importService();
      const { user } = _buildPrompt(
        "situational-grounding",
        "US-China trade war",
        undefined,
        undefined,
        undefined,
        { webSearch: true, effortLevel: "low" },
      );

      expect(user).toContain('Effort level: "low"');
      expect(user).toContain(
        "Prioritize core players, objectives, strategic structure, and the minimum research needed for a useful answer.",
      );
      expect(user).toContain(
        "Avoid unnecessary branching or long-tail possibilities.",
      );
      expect(user).toContain("Prefer concise outputs when uncertainty is high.");
    });

    it("builds prompt with high effort guidance", async () => {
      const { _buildPrompt } = await importService();
      const { user } = _buildPrompt(
        "situational-grounding",
        "US-China trade war",
        undefined,
        undefined,
        undefined,
        { webSearch: true, effortLevel: "high" },
      );

      expect(user).toContain('Effort level: "high"');
      expect(user).toContain(
        "Allow broader research and comparison when it materially improves the analysis.",
      );
      expect(user).toContain(
        "Surface more alternatives, assumptions, and uncertainty explicitly.",
      );
      expect(user).toContain(
        "Spend more attention on edge cases and competing explanations.",
      );
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
            "id": null,
            "ref": "fact-1",
            "type": "fact",
            "phase": "situational-grounding",
            "data": {
              "type": "fact",
              "date": "2025-01-01",
              "source": "Test",
              "content": "Test fact",
              "category": "action",
            },
            "confidence": "high",
            "rationale": "Test",
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

    it("accepts entity with confidence and required ref", async () => {
      const { _validatePhaseOutput } = await importService();
      const result = _validatePhaseOutput(
        {
          entities: [
            {
              id: null,
              ref: "fact-regression",
              type: "fact",
              phase: "situational-grounding",
              data: {
                type: "fact",
                date: "2025-01-01",
                source: "Reuters",
                content: "Test content",
                category: "action",
              },
              confidence: "high",
              rationale: "Test rationale",
            },
          ],
          relationships: [],
        },
        "situational-grounding",
      );
      expect(result.success).toBe(true);
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].confidence).toBe("high");
    });

    it("rejects entity missing required ref", async () => {
      const { _validatePhaseOutput } = await importService();
      const result = _validatePhaseOutput(
        {
          entities: [
            {
              id: null,
              type: "fact",
              phase: "situational-grounding",
              data: {
                type: "fact",
                date: "2025-01-01",
                source: "Bloomberg",
                content: "Test content",
                category: "economic",
              },
              confidence: "medium",
              rationale: "Test",
            },
          ],
          relationships: [],
        },
        "situational-grounding",
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Entity 0");
    });

    it("rejects entity with invalid confidence value", async () => {
      const { _validatePhaseOutput } = await importService();
      const result = _validatePhaseOutput(
        {
          entities: [
            {
              id: null,
              ref: "fact-bad-conf",
              type: "fact",
              phase: "situational-grounding",
              data: {
                type: "fact",
                date: "2025-01-01",
                source: "Test",
                content: "Test",
                category: "action",
              },
              confidence: "ai", // wrong — this is a source value, not confidence
              rationale: "Test",
            },
          ],
          relationships: [],
        },
        "situational-grounding",
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Entity 0");
    });
  });
});
