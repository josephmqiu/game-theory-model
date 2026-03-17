import { beforeEach, describe, expect, it, vi } from "vitest";

import { emptyCanonicalStore, type CanonicalStore } from "../types/canonical";
import type { AnalysisState, PhaseExecution } from "../types/analysis-pipeline";
import { scenarioSchema, canonicalStoreSchema } from "../types/schemas";
import { reduce } from "../engine/reducer";
import { getDerivedStore, resetDerivedState } from "../store/derived"; // TODO: store import — needs PipelineHost
import { runPhase6Formalization } from "./phase-6-formalization";
import { runPhase7Assumptions } from "./phase-7-assumptions";
import { runPhase8Elimination } from "./phase-8-elimination";
import { runPhase9Scenarios } from "./phase-9-scenarios";
import { classifySituation, createEntityId, createEstimate } from "./helpers";

function createExecution(phase: number): PhaseExecution {
  return {
    id: createEntityId("phase_execution"),
    phase,
    pass_number: 1,
    provider_id: "test",
    model_id: "test-model",
    prompt_version_id: "test",
    started_at: new Date().toISOString(),
    completed_at: null,
    duration_ms: null,
    input_tokens: 0,
    output_tokens: 0,
    cost_usd: null,
    status: "running",
    error: null,
  };
}

function createAnalysisState(description: string): AnalysisState {
  return {
    id: createEntityId("analysis"),
    event_description: description,
    domain: classifySituation(description).domain,
    current_phase: null,
    phase_states: Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => {
        const phase = index + 1;
        return [
          phase,
          {
            phase,
            status: phase === 1 ? "complete" : "pending",
            pass_number: 1,
            started_at: null,
            completed_at: null,
            phase_execution_id: null,
          },
        ];
      }),
    ) as AnalysisState["phase_states"],
    pass_number: 1,
    status: "running",
    started_at: new Date().toISOString(),
    completed_at: null,
    classification: classifySituation(description),
  };
}

function createPhase4HistoryResult() {
  return {
    phase: 4 as const,
    status: {
      status: "complete" as const,
      phase: 4,
      execution_id: "phase_execution_4",
      retriable: true,
    },
    repeated_game_map: [],
    patterns_found: [
      {
        game_id: "game_1",
        pattern_type: "grim_trigger" as const,
        description: "Repeated punishment pattern.",
        instances: [],
        impact_on_trust: "lowers trust",
        impact_on_model: "supports repeated-game framing",
      },
    ],
    trust_assessment: [],
    dynamic_inconsistency_risks: [],
    global_signaling_effects: ["Signals shape beliefs."],
    baseline_recheck: {
      game_still_correct: true,
      revealed_repeated_not_oneshot: false,
      hidden_player_found: false,
      hidden_commitment_problem: false,
      hidden_type_uncertainty: true,
      cooperative_equilibria_eliminated: false,
      objective_function_changed: false,
      deterrence_compellence_reframed: false,
      revalidation_needed: false,
      revalidation_triggers: [],
    },
    proposals: [],
  };
}

function createCanonicalStore(): CanonicalStore {
  const now = new Date().toISOString();
  const store: CanonicalStore = {
    ...emptyCanonicalStore(),
    players: {
      player_a: {
        id: "player_a",
        name: "State A",
        type: "state",
        role: "primary",
        objectives: [
          {
            label: "Preserve leverage",
            weight: createEstimate(0.8, "Primary objective"),
          },
        ],
        constraints: [{ label: "Budget", type: "resource", severity: "hard" }],
      },
      player_b: {
        id: "player_b",
        name: "State B",
        type: "state",
        role: "primary",
        objectives: [
          {
            label: "Avoid escalation",
            weight: createEstimate(0.7, "Primary objective"),
          },
        ],
        constraints: [
          {
            label: "Alliance commitments",
            type: "diplomatic",
            severity: "soft",
          },
        ],
      },
    },
    games: {
      game_1: {
        id: "game_1",
        name: "Baseline game",
        description: "Existing baseline game.",
        semantic_labels: ["bargaining", "signaling"],
        players: ["player_a", "player_b"],
        status: "active",
        formalizations: ["formalization_base"],
        coupling_links: [],
        key_assumptions: [],
        created_at: now,
        updated_at: now,
        canonical_game_type: "bargaining",
        move_order: "simultaneous",
      },
    },
    formalizations: {
      formalization_base: {
        id: "formalization_base",
        game_id: "game_1",
        kind: "normal_form",
        purpose: "explanatory",
        abstraction_level: "minimal",
        assumptions: [],
        strategies: {
          player_a: ["Escalate", "Hold"],
          player_b: ["Resist", "Accommodate"],
        },
        payoff_cells: [
          {
            strategy_profile: { player_a: "Escalate", player_b: "Resist" },
            payoffs: {
              player_a: createEstimate(1, "baseline"),
              player_b: createEstimate(3, "baseline"),
            },
          },
          {
            strategy_profile: { player_a: "Escalate", player_b: "Accommodate" },
            payoffs: {
              player_a: createEstimate(4, "baseline"),
              player_b: createEstimate(1, "baseline"),
            },
          },
          {
            strategy_profile: { player_a: "Hold", player_b: "Resist" },
            payoffs: {
              player_a: createEstimate(2, "baseline"),
              player_b: createEstimate(2, "baseline"),
            },
          },
          {
            strategy_profile: { player_a: "Hold", player_b: "Accommodate" },
            payoffs: {
              player_a: createEstimate(3, "baseline"),
              player_b: createEstimate(2, "baseline"),
            },
          },
        ],
      },
    },
  };

  store.claims.claim_direct = {
    id: "claim_direct",
    statement: "Operational reporting supports the baseline.",
    based_on: ["observation_1"],
    confidence: 0.82,
  };
  store.inferences.inference_only = {
    id: "inference_only",
    statement: "Analyst inference about hidden capacity.",
    derived_from: ["claim_direct"],
    confidence: 0.68,
    rationale: "Inferred from indirect posture changes.",
  };
  store.observations.observation_1 = {
    id: "observation_1",
    source_id: "source_1",
    text: "Observed deployment and sanctions posture.",
    captured_at: now,
  };
  store.sources.source_1 = {
    id: "source_1",
    kind: "manual",
    title: "Direct reporting",
    captured_at: now,
    quality_rating: "high",
  };

  store.assumptions.assumption_behavioral = {
    id: "assumption_behavioral",
    statement: "State A still prioritizes domestic signaling over compromise.",
    type: "behavioral",
    sensitivity: "medium",
    confidence: 0.62,
    supported_by: ["claim_direct"],
    game_theoretic_vs_empirical: "empirical",
    correlated_cluster_id: null,
  };
  store.assumptions.assumption_capability = {
    id: "assumption_capability",
    statement: "State B retains enough coercive capacity to sustain pressure.",
    type: "capability",
    sensitivity: "medium",
    confidence: 0.58,
    supported_by: ["inference_only"],
    game_theoretic_vs_empirical: "empirical",
    correlated_cluster_id: null,
  };
  store.assumptions.assumption_structural = {
    id: "assumption_structural",
    statement:
      "The accepted baseline still captures the strategic action menu.",
    type: "structural",
    sensitivity: "medium",
    confidence: 0.64,
    supported_by: ["claim_direct"],
    game_theoretic_vs_empirical: "game_theoretic",
    correlated_cluster_id: null,
  };
  store.assumptions.assumption_institutional = {
    id: "assumption_institutional",
    statement: "Alliance rules will keep constraining rapid escalation.",
    type: "institutional",
    sensitivity: "medium",
    confidence: 0.61,
    supported_by: ["claim_direct"],
    game_theoretic_vs_empirical: "empirical",
    correlated_cluster_id: null,
  };
  store.assumptions.assumption_rationality = {
    id: "assumption_rationality",
    statement: "Both sides still optimize against regime-survival payoffs.",
    type: "rationality",
    sensitivity: "medium",
    confidence: 0.6,
    supported_by: ["claim_direct"],
    game_theoretic_vs_empirical: "game_theoretic",
    correlated_cluster_id: null,
  };
  store.assumptions.assumption_information = {
    id: "assumption_information",
    statement:
      "Important military and political constraints remain privately held.",
    type: "information",
    sensitivity: "medium",
    confidence: 0.59,
    game_theoretic_vs_empirical: "game_theoretic",
    correlated_cluster_id: null,
  };

  store.games.game_1!.key_assumptions = [
    "assumption_behavioral",
    "assumption_institutional",
  ];
  const baseline = store.formalizations.formalization_base;
  if (baseline && baseline.kind === "normal_form") {
    baseline.assumptions = [
      "assumption_capability",
      "assumption_structural",
      "assumption_rationality",
      "assumption_information",
    ];
  }

  return store;
}

function runPriorPhases(canonical: CanonicalStore) {
  const phase6 = runPhase6Formalization(
    { subsections: ["6c"] },
    {
      canonical,
      analysisState: createAnalysisState(
        "Negotiation with repeated signaling and private information",
      ),
      baseRevision: 0,
      phaseExecution: createExecution(6),
      phaseResults: {
        4: createPhase4HistoryResult(),
      },
    },
  );

  const phase7 = runPhase7Assumptions({
    canonical,
    baseRevision: 0,
    phaseExecution: createExecution(7),
    getDerivedState: () => getDerivedStore().getState(),
    phaseResults: {
      4: createPhase4HistoryResult(),
      6: phase6,
    },
  });

  const phase8 = runPhase8Elimination({
    canonical,
    baseRevision: 0,
    phaseExecution: createExecution(8),
    phaseResults: {
      6: phase6,
      7: phase7,
    },
  });

  return { phase6, phase7, phase8 };
}

describe("Phase 9 scenario generation runner", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetDerivedState();
  });

  it("generates scenarios with narrative and probability from game formalizations", () => {
    const canonical = createCanonicalStore();
    const { phase6, phase7, phase8 } = runPriorPhases(canonical);

    const result = runPhase9Scenarios({
      canonical,
      baseRevision: 0,
      phaseExecution: createExecution(9),
      phaseResults: {
        6: phase6,
        7: phase7,
        8: phase8,
      },
    });

    expect(result.phase).toBe(9);
    expect(result.status.status).toBe("complete");
    expect(result.proposed_scenarios.length).toBeGreaterThan(0);

    for (const scenario of result.proposed_scenarios) {
      expect(scenario.narrative.summary).toBeTruthy();
      expect(scenario.narrative.summary.length).toBeGreaterThan(0);
      expect(scenario.probability.mode).toBe("point");
      expect(typeof scenario.probability.value).toBe("number");
      expect(scenario.probability.value).toBeGreaterThan(0);
      expect(scenario.probability.value).toBeLessThanOrEqual(1);
      expect(typeof scenario.probability.confidence).toBe("number");
      expect(scenario.probability.rationale.length).toBeGreaterThan(0);
      expect(Array.isArray(scenario.probability.source_claims)).toBe(true);
      expect(Array.isArray(scenario.probability.assumptions)).toBe(true);
      expect(["equilibrium", "discretionary", "mixed"]).toContain(
        scenario.forecast_basis,
      );
    }
  });

  it("produces a central thesis with falsification condition", () => {
    const canonical = createCanonicalStore();
    const { phase6, phase7, phase8 } = runPriorPhases(canonical);

    const result = runPhase9Scenarios({
      canonical,
      baseRevision: 0,
      phaseExecution: createExecution(9),
      phaseResults: {
        6: phase6,
        7: phase7,
        8: phase8,
      },
    });

    expect(result.central_thesis.statement).toBeTruthy();
    expect(result.central_thesis.statement.length).toBeGreaterThan(0);
    expect(result.central_thesis.falsification_condition).toBeTruthy();
    expect(
      result.central_thesis.falsification_condition.length,
    ).toBeGreaterThan(0);

    for (const scenarioRef of result.central_thesis.scenario_refs) {
      const matchingScenario = result.proposed_scenarios.find(
        (s) => s.temp_id === scenarioRef,
      );
      expect(matchingScenario).toBeDefined();
    }
  });

  it("identifies tail risks from critical assumptions", () => {
    const canonical = createCanonicalStore();

    getDerivedStore().setState((state) => ({
      ...state,
      sensitivityByFormalizationAndSolver: {
        ...state.sensitivityByFormalizationAndSolver,
        formalization_base: {
          ...(state.sensitivityByFormalizationAndSolver.formalization_base ??
            {}),
          nash: {
            formalization_id: "formalization_base",
            solver: "nash",
            solver_result_id: "solver_1",
            computed_at: new Date().toISOString(),
            payoff_sensitivities: [],
            assumption_sensitivities: [
              {
                assumption_id: "assumption_capability",
                statement:
                  canonical.assumptions.assumption_capability!.statement,
                impact: "result_changes",
                description: "Flips the current equilibrium read.",
                affected_payoffs: ["player_a:Escalate|Resist"],
              },
            ],
            threshold_analysis: [],
            overall_robustness: "fragile",
          },
        },
      },
    }));

    const { phase6, phase7, phase8 } = runPriorPhases(canonical);

    const result = runPhase9Scenarios({
      canonical,
      baseRevision: 0,
      phaseExecution: createExecution(9),
      phaseResults: {
        6: phase6,
        7: phase7,
        8: phase8,
      },
    });

    expect(Array.isArray(result.tail_risks)).toBe(true);

    for (const risk of result.tail_risks) {
      expect(risk.event_description).toBeTruthy();
      expect(risk.probability.mode).toBe("point");
      expect(typeof risk.probability.value).toBe("number");
      expect(risk.trigger).toBeTruthy();
      expect(typeof risk.drift_toward).toBe("boolean");
    }
  });

  it("checks probability sum", () => {
    const canonical = createCanonicalStore();
    const { phase6, phase7, phase8 } = runPriorPhases(canonical);

    const result = runPhase9Scenarios({
      canonical,
      baseRevision: 0,
      phaseExecution: createExecution(9),
      phaseResults: {
        6: phase6,
        7: phase7,
        8: phase8,
      },
    });

    expect(typeof result.probability_check.sum).toBe("number");
    expect(typeof result.probability_check.missing_probability).toBe("number");
    expect(result.probability_check.missing_probability).toBeGreaterThanOrEqual(
      0,
    );

    const expectedSum = result.proposed_scenarios.reduce(
      (total, scenario) => total + (scenario.probability.value ?? 0),
      0,
    );
    expect(result.probability_check.sum).toBeCloseTo(expectedSum, 3);
  });

  it("produces add_scenario and add_central_thesis proposals", () => {
    const canonical = createCanonicalStore();
    const { phase6, phase7, phase8 } = runPriorPhases(canonical);

    const result = runPhase9Scenarios({
      canonical,
      baseRevision: 0,
      phaseExecution: createExecution(9),
      phaseResults: {
        6: phase6,
        7: phase7,
        8: phase8,
      },
    });

    expect(result.proposals.length).toBeGreaterThan(0);

    const scenarioProposals = result.proposals.filter((proposal) =>
      proposal.commands.some((command) => command.kind === "add_scenario"),
    );
    expect(scenarioProposals.length).toBeGreaterThan(0);
    for (const proposal of scenarioProposals) {
      expect(proposal.proposal_type).toBe("scenario");
      expect(proposal.phase).toBe(9);
      expect(proposal.entity_previews.length).toBeGreaterThan(0);
    }

    const thesisProposals = result.proposals.filter((proposal) =>
      proposal.commands.some(
        (command) => command.kind === "add_central_thesis",
      ),
    );
    expect(thesisProposals.length).toBe(1);
    expect(thesisProposals[0]!.proposal_type).toBe("thesis");
  });

  it("scenario proposal commands produce schema-valid entities when dispatched", () => {
    const canonical = createCanonicalStore();
    const { phase6, phase7, phase8 } = runPriorPhases(canonical);

    const result = runPhase9Scenarios({
      canonical,
      baseRevision: 0,
      phaseExecution: createExecution(9),
      phaseResults: {
        6: phase6,
        7: phase7,
        8: phase8,
      },
    });

    const scenarioProposals = result.proposals.filter((p) =>
      p.commands.some((c) => c.kind === "add_scenario"),
    );
    expect(scenarioProposals.length).toBeGreaterThan(0);

    for (const proposal of scenarioProposals) {
      const batchCommand = {
        kind: "batch" as const,
        label: proposal.description,
        commands: proposal.commands,
      };

      // Test through the reducer + schema validation (same as dispatch)
      const reduceResult = reduce(canonical, batchCommand);
      expect(reduceResult.newStore).toBeDefined();

      // Also validate each scenario entity individually
      for (const command of proposal.commands) {
        if (command.kind !== "add_scenario") continue;
        const addCmd = command as {
          kind: string;
          id: string;
          payload: Record<string, unknown>;
        };
        const entity = { ...addCmd.payload, id: addCmd.id };
        const parseResult = scenarioSchema.safeParse(entity);
        if (!parseResult.success) {
          // Log exact validation errors for debugging
          for (const issue of parseResult.error.issues) {
            console.error(
              `Scenario schema error: path=${issue.path.join(".")}, message=${issue.message}, received=${JSON.stringify((issue as { received?: unknown }).received)}`,
            );
          }
        }
        expect(parseResult.success).toBe(true);
      }
    }

    // Also validate thesis proposals
    const thesisProposals = result.proposals.filter((p) =>
      p.commands.some((c) => c.kind === "add_central_thesis"),
    );
    for (const proposal of thesisProposals) {
      const batchCommand = {
        kind: "batch" as const,
        label: proposal.description,
        // Thesis may reference scenario IDs that don't exist yet in canonical,
        // so we dispatch scenario proposals first
        commands: proposal.commands,
      };

      // We need the scenarios in the store first for the thesis refs
      let storeWithScenarios = canonical;
      for (const scenarioProposal of scenarioProposals) {
        const scenarioBatch = {
          kind: "batch" as const,
          label: scenarioProposal.description,
          commands: scenarioProposal.commands,
        };
        storeWithScenarios = reduce(storeWithScenarios, scenarioBatch).newStore;
      }

      const reduceResult = reduce(storeWithScenarios, batchCommand);
      expect(reduceResult.newStore).toBeDefined();
    }
  });

  it("returns partial result when Phase 6 data is missing", () => {
    const canonical = createCanonicalStore();

    const result = runPhase9Scenarios({
      canonical,
      baseRevision: 0,
      phaseExecution: createExecution(9),
      phaseResults: {},
    });

    expect(result.phase).toBe(9);
    expect(result.status.status).toBe("partial");
    expect(result.status.gaps).toBeDefined();
    expect(
      result.status.gaps!.some((gap) => gap.toLowerCase().includes("phase 6")),
    ).toBe(true);
    expect(result.proposed_scenarios).toEqual([]);
    expect(result.tail_risks).toEqual([]);
    expect(result.proposals).toEqual([]);
    expect(result.central_thesis.statement).toBeTruthy();
    expect(result.probability_check.sum).toBe(0);
  });
});
