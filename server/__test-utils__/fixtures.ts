/**
 * Shared test fixtures and factory functions for integration tests.
 * Extracted from individual test files to provide a single source of truth.
 */

import type { MethodologyPhase } from "../../shared/types/methodology";

// ── Service reset ──

export async function resetAllServices(): Promise<void> {
  const [entityGraph, runtimeStatus, revalidation, orchestrator] =
    await Promise.all([
      import("../services/entity-graph-service"),
      import("../services/runtime-status"),
      import("../services/revalidation-service"),
      import("../agents/analysis-agent"),
    ]);
  entityGraph._resetForTest();
  runtimeStatus._resetForTest();
  revalidation._resetForTest();
  orchestrator._resetForTest();
}

// ── Phase output factories (for adapter mock responses & commitPhaseSnapshot) ──

export function makeFactOutput(overrides?: {
  id?: string | null;
  ref?: string;
  content?: string;
}) {
  return {
    id: overrides?.id ?? null,
    ref: overrides?.ref ?? "fact-ref",
    type: "fact" as const,
    phase: "situational-grounding" as const,
    data: {
      type: "fact" as const,
      date: "2026-03-19",
      source: "test",
      content: overrides?.content ?? "A fact",
      category: "action" as const,
    },
    confidence: "high" as const,
    rationale: `rationale:${overrides?.content ?? "A fact"}`,
  };
}

// ── Complete phase output fixtures (valid adapter responses) ──

export const PHASE_FIXTURES: Partial<
  Record<MethodologyPhase, { entities: unknown[]; relationships: unknown[] }>
> = {
  "situational-grounding": {
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
  },

  "player-identification": {
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
  },

  "baseline-model": {
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
  },

  "historical-game": {
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
          evidence: "Each tariff round was met with counter-tariffs",
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
    ],
    relationships: [
      {
        id: "rel-h1",
        type: "derived-from",
        fromEntityId: "pattern-1",
        toEntityId: "history-1",
      },
    ],
  },

  "formal-modeling": {
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
                "Prior rounds of escalation make cooperation hard to restore",
              weight: "high",
            },
          ],
        },
        confidence: "medium",
        rationale: "Dominant strategy equilibrium given low trust",
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
    ],
    relationships: [
      {
        id: "rel-f1",
        type: "depends-on",
        fromEntityId: "effect-1",
        toEntityId: "matrix-1",
      },
    ],
  },

  assumptions: {
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
        rationale:
          "Standard assumption but may not hold under domestic pressure",
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
  },

  elimination: {
    entities: [
      {
        id: null,
        ref: "eliminated-1",
        type: "eliminated-outcome",
        phase: "elimination",
        data: {
          type: "eliminated-outcome",
          description:
            "Country B accepts permanent steel tariffs without retaliation",
          traced_reasoning:
            "Low trust and prior tit-for-tat behavior make unilateral concession inconsistent with the repeated-game evidence.",
          source_phase: "historical-game",
          source_entity_ids: ["history-1", "pattern-1"],
        },
        confidence: "high",
        rationale: "Contradicts the observed retaliation pattern",
      },
    ],
    relationships: [],
  },

  scenarios: {
    entities: [
      {
        id: null,
        ref: "scenario-baseline",
        type: "scenario",
        phase: "scenarios",
        data: {
          type: "scenario",
          subtype: "baseline",
          narrative:
            "Both countries escalate briefly, then negotiate a partial tariff rollback once export losses become salient.",
          probability: {
            point: 70,
            rangeLow: 60,
            rangeHigh: 80,
          },
          key_assumptions: ["assumption-1", "assumption-2"],
          invalidation_conditions:
            "A binding third-party enforcement mechanism changes retaliation incentives.",
          model_basis: ["equil-1"],
          cross_game_interactions:
            "Tech-sector retaliation remains a bargaining threat rather than the primary game.",
          prediction_basis: "equilibrium",
          trigger: null,
          why_unlikely: null,
          consequences: null,
          drift_trajectory: null,
        },
        confidence: "medium",
        rationale: "Most consistent with the payoff model and history",
      },
      {
        id: null,
        ref: "scenario-tail",
        type: "scenario",
        phase: "scenarios",
        data: {
          type: "scenario",
          subtype: "tail-risk",
          narrative:
            "A domestic political shock makes backing down impossible and drives a broader trade freeze.",
          probability: {
            point: 30,
            rangeLow: 20,
            rangeHigh: 40,
          },
          key_assumptions: ["assumption-1"],
          invalidation_conditions:
            "Domestic audiences accept a negotiated settlement quickly.",
          model_basis: ["effect-1"],
          cross_game_interactions:
            "Steel escalation spills into technology restrictions.",
          prediction_basis: "behavioral-overlay",
          trigger: "Election-cycle nationalist pressure spikes",
          why_unlikely:
            "Both countries still face material economic costs from escalation.",
          consequences: "Broader retaliation and lower cooperation payoffs",
          drift_trajectory:
            "Tariff dispute expands from sectoral retaliation into multi-sector decoupling.",
        },
        confidence: "low",
        rationale: "Requires a political shock beyond the baseline model",
      },
      {
        id: null,
        ref: "thesis-1",
        type: "central-thesis",
        phase: "scenarios",
        data: {
          type: "central-thesis",
          thesis:
            "The tariff dispute is likely to settle after controlled escalation because mutual losses dominate the strategic upside.",
          falsification_conditions:
            "A credible commitment device fails or domestic politics rewards indefinite escalation.",
          supporting_scenarios: ["scenario-baseline", "scenario-tail"],
        },
        confidence: "medium",
        rationale: "Summarizes the scenario distribution",
      },
    ],
    relationships: [
      {
        id: "rel-s1",
        type: "derived-from",
        fromEntityId: "thesis-1",
        toEntityId: "scenario-baseline",
      },
    ],
  },

  "meta-check": {
    entities: [
      {
        id: null,
        ref: "meta-1",
        type: "meta-check",
        phase: "meta-check",
        data: {
          type: "meta-check",
          questions: [
            {
              question_number: 1,
              answer: "The main players have been identified.",
              disruption_trigger_identified: false,
            },
            {
              question_number: 2,
              answer: "Objectives are explicit enough for the model.",
              disruption_trigger_identified: false,
            },
            {
              question_number: 3,
              answer: "The baseline game matches the tariff escalation facts.",
              disruption_trigger_identified: false,
            },
            {
              question_number: 4,
              answer: "Repeated-game history supports low trust.",
              disruption_trigger_identified: false,
            },
            {
              question_number: 5,
              answer: "Formal payoffs remain sensitive to export loss estimates.",
              disruption_trigger_identified: false,
            },
            {
              question_number: 6,
              answer: "Key rationality assumptions are visible.",
              disruption_trigger_identified: false,
            },
            {
              question_number: 7,
              answer: "Eliminated outcomes trace back to prior phase evidence.",
              disruption_trigger_identified: false,
            },
            {
              question_number: 8,
              answer: "Scenario probabilities sum to the expected range.",
              disruption_trigger_identified: false,
            },
            {
              question_number: 9,
              answer: "No missing player changes the headline scenario.",
              disruption_trigger_identified: false,
            },
            {
              question_number: 10,
              answer: "The synthesis can proceed from the completed ladder.",
              disruption_trigger_identified: false,
            },
          ],
        },
        confidence: "high",
        rationale: "Checklist completed without loopback trigger",
      },
    ],
    relationships: [],
  },
};

/**
 * Returns a deep-cloned phase output fixture for use in tests.
 */
export function getPhaseFixture(phase: MethodologyPhase) {
  const fixture = PHASE_FIXTURES[phase];
  if (!fixture) {
    throw new Error(
      `No fixture for phase "${phase}". Available: ${Object.keys(PHASE_FIXTURES).join(", ")}`,
    );
  }
  return JSON.parse(JSON.stringify(fixture));
}
