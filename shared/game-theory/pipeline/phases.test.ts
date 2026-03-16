import { beforeEach, describe, expect, it, vi } from "vitest";

import { emptyCanonicalStore, type CanonicalStore } from "../types/canonical";
import type { AnalysisState, PhaseExecution } from "../types/analysis-pipeline";
import { getDerivedStore, resetDerivedState } from "../store/derived"; // TODO: store import — needs PipelineHost
import * as dispatchModule from "../engine/dispatch";
import { runPhase1Grounding } from "./phase-1-grounding";
import { runPhase2Players } from "./phase-2-players";
import { runPhase6Formalization } from "./phase-6-formalization";
import { runPhase7Assumptions } from "./phase-7-assumptions";
import { runPhase3Baseline, runPhase4History } from "./phase-3-4";
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

function createPlayersCanonicalStore(): CanonicalStore {
  const now = new Date().toISOString();
  return {
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
        semantic_labels: ["bargaining"],
        players: ["player_a", "player_b"],
        status: "active",
        formalizations: [],
        coupling_links: [],
        key_assumptions: [],
        created_at: now,
        updated_at: now,
      },
    },
  };
}

function createPhase6CanonicalStore(includeSecondGame = false): CanonicalStore {
  const now = new Date().toISOString();
  const store = createPlayersCanonicalStore();

  store.games.game_1 = {
    ...store.games.game_1!,
    formalizations: ["formalization_base"],
    canonical_game_type: "bargaining",
    move_order: "simultaneous",
    semantic_labels: ["bargaining", "signaling"],
  };
  store.formalizations.formalization_base = {
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
  };

  if (includeSecondGame) {
    store.games.game_2 = {
      id: "game_2",
      name: "Second theater",
      description: "Parallel strategic theater.",
      semantic_labels: ["coordination"],
      players: ["player_a", "player_b"],
      status: "active",
      formalizations: [],
      coupling_links: [],
      key_assumptions: [],
      created_at: now,
      updated_at: now,
    };
  }

  return store;
}

function createPhase7CanonicalStore(): CanonicalStore {
  const store = createPhase6CanonicalStore();
  const now = new Date().toISOString();

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
  store.scenarios.scenario_1 = {
    id: "scenario_1",
    name: "Baseline coercive bargaining",
    formalization_id: "formalization_base",
    path: [],
    probability_model: "ordinal_only",
    key_assumptions: ["assumption_capability", "assumption_behavioral"],
    invalidators: [],
    narrative: "Baseline scenario",
  };

  return store;
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

describe("M5 phase runners", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetDerivedState();
  });

  it("builds phase 1 grounding proposals across all seven evidence categories", () => {
    const output = runPhase1Grounding(
      { situation_description: "State A vs State B sanctions bargaining" },
      {
        canonical: emptyCanonicalStore(),
        baseRevision: 0,
        phaseExecution: createExecution(1),
      },
    );

    expect(output.classification.domain).toBe("geopolitical");
    expect(Object.keys(output.result.evidence_by_category)).toHaveLength(7);
    expect(output.result.proposals).toHaveLength(7);
  });

  it("surfaces unmatched focus areas as phase 1 grounding gaps", () => {
    const output = runPhase1Grounding(
      {
        situation_description: "State A vs State B sanctions bargaining",
        focus_areas: ["intel", "timeline"],
      },
      {
        canonical: emptyCanonicalStore(),
        baseRevision: 0,
        phaseExecution: createExecution(1),
      },
    );

    expect(output.result.coverage_assessment.gaps).toEqual(["intel"]);
  });

  it("adds an internal player proposal when internal agency is detected", () => {
    const output = runPhase2Players(
      {
        additional_context:
          "Cabinet faction has its own independent incentives.",
      },
      {
        canonical: emptyCanonicalStore(),
        analysisState: createAnalysisState(
          "State A cabinet bargaining with State B",
        ),
        baseRevision: 0,
        phaseExecution: createExecution(2),
      },
    );

    expect(
      output.proposed_players.some((player) => player.role === "internal"),
    ).toBe(true);
    expect(
      output.proposals.every((proposal) =>
        proposal.commands.every(
          (command) => command.kind !== "trigger_revalidation",
        ),
      ),
    ).toBe(true);
  });

  it("builds a minimal baseline game proposal with a formalization", () => {
    const output = runPhase3Baseline({
      canonical: createPlayersCanonicalStore(),
      analysisState: createAnalysisState(
        "State A vs State B sanctions bargaining",
      ),
      baseRevision: 0,
      phaseExecution: createExecution(3),
    });

    expect(output.status.status).toBe("complete");
    expect(output.proposed_games).toHaveLength(1);
    expect(
      output.proposals.some((proposal) => proposal.proposal_type === "game"),
    ).toBe(true);
    expect(
      output.proposals.some((proposal) =>
        proposal.entity_previews.some(
          (preview) => preview.entity_type === "formalization",
        ),
      ),
    ).toBe(true);
  });

  it("builds historical trust/risk proposals while surfacing a revalidation-worthy baseline recheck", () => {
    const output = runPhase4History({
      canonical: createPlayersCanonicalStore(),
      analysisState: createAnalysisState(
        "Volatile election cycle raises sanctions bargaining risk",
      ),
      baseRevision: 0,
      phaseExecution: createExecution(4),
    });

    expect(output.status.status).toBe("complete");
    expect(output.trust_assessment).toHaveLength(1);
    expect(output.dynamic_inconsistency_risks[0]?.durability).toBe("fragile");
    expect(output.baseline_recheck.revalidation_needed).toBe(true);
    expect(
      output.proposals.every((proposal) =>
        proposal.commands.every(
          (command) => command.kind !== "trigger_revalidation",
        ),
      ),
    ).toBe(true);
  });

  it("reuses the accepted baseline formalization and adds complementary Phase 6 representations without mutating canonical state", () => {
    const canonical = createPhase6CanonicalStore();
    const originalFormalizations = Object.keys(canonical.formalizations);

    const output = runPhase6Formalization(undefined, {
      canonical,
      analysisState: createAnalysisState(
        "Negotiation with repeated signaling and private information",
      ),
      baseRevision: 0,
      phaseExecution: createExecution(6),
      phaseResults: {
        4: createPhase4HistoryResult(),
      },
    });

    expect(output.formal_representations.reused_formalization_ids).toContain(
      "formalization_base",
    );
    expect(
      output.formal_representations.summaries.some(
        (summary) => summary.kind === "repeated",
      ),
    ).toBe(true);
    expect(
      output.formal_representations.summaries.some(
        (summary) => summary.kind === "bayesian",
      ),
    ).toBe(true);
    expect(
      output.communication_analysis.classifications.length,
    ).toBeGreaterThan(0);
    expect(
      output.proposals.some(
        (proposal) => proposal.proposal_type === "formalization",
      ),
    ).toBe(true);
    expect(Object.keys(canonical.formalizations)).toEqual(
      originalFormalizations,
    );
    expect(Object.keys(canonical.signal_classifications)).toHaveLength(0);
  });

  it("returns a partial Phase 6 result when requested subsections lack prerequisites", () => {
    const output = runPhase6Formalization(
      { subsections: ["6i"] },
      {
        canonical: createPhase6CanonicalStore(false),
        analysisState: createAnalysisState("Single-game bargaining case"),
        baseRevision: 0,
        phaseExecution: createExecution(6),
        phaseResults: {},
      },
    );

    expect(output.status.status).toBe("partial");
    expect(output.cross_game_effects).toBeNull();
    expect(
      output.subsection_statuses.find((entry) => entry.subsection === "6i")
        ?.status,
    ).toBe("not_applicable");
  });

  it("uses accepted canonical formalizations when 6c runs without 6a", () => {
    const output = runPhase6Formalization(
      { subsections: ["6c"] },
      {
        canonical: createPhase6CanonicalStore(),
        analysisState: createAnalysisState(
          "Focused equilibrium review of the accepted baseline",
        ),
        baseRevision: 0,
        phaseExecution: createExecution(6),
        phaseResults: {},
      },
    );

    expect(output.formal_representations.status).toBe("not_applicable");
    expect(output.baseline_equilibria.analyses.length).toBeGreaterThan(0);
    expect(output.baseline_equilibria.analyses[0]?.formalization_id).toBe(
      "formalization_base",
    );
  });

  it("preserves accepted normal-form strategy labels when 6b and 6c run without 6a", () => {
    const canonical = createPhase6CanonicalStore();
    const baseline = canonical.formalizations.formalization_base;
    if (!baseline || baseline.kind !== "normal_form") {
      throw new Error("Expected a normal-form baseline formalization.");
    }

    baseline.strategies = {
      player_a: ["Cooperate", "Defect"],
      player_b: ["Cooperate", "Defect"],
    };
    baseline.payoff_cells = [
      {
        strategy_profile: { player_a: "Cooperate", player_b: "Cooperate" },
        payoffs: {
          player_a: createEstimate(3, "baseline"),
          player_b: createEstimate(3, "baseline"),
        },
      },
      {
        strategy_profile: { player_a: "Cooperate", player_b: "Defect" },
        payoffs: {
          player_a: createEstimate(0, "baseline"),
          player_b: createEstimate(5, "baseline"),
        },
      },
      {
        strategy_profile: { player_a: "Defect", player_b: "Cooperate" },
        payoffs: {
          player_a: createEstimate(5, "baseline"),
          player_b: createEstimate(0, "baseline"),
        },
      },
      {
        strategy_profile: { player_a: "Defect", player_b: "Defect" },
        payoffs: {
          player_a: createEstimate(1, "baseline"),
          player_b: createEstimate(1, "baseline"),
        },
      },
    ];

    const output = runPhase6Formalization(
      { subsections: ["6b", "6c"] },
      {
        canonical,
        analysisState: createAnalysisState(
          "Focused payoff and equilibrium refresh of the accepted baseline",
        ),
        baseRevision: 0,
        phaseExecution: createExecution(6),
        phaseResults: {},
      },
    );

    const preview = output.workspace_previews.formalization_base;
    expect(preview?.kind).toBe("normal_form");
    if (!preview || preview.kind !== "normal_form") {
      throw new Error("Expected a normal-form workspace preview.");
    }

    expect(preview.row_strategies).toEqual(["Cooperate", "Defect"]);
    expect(preview.col_strategies).toEqual(["Cooperate", "Defect"]);
    expect(
      output.baseline_equilibria.analyses[0]?.solver_summaries.some(
        (summary) => summary.solver === "nash",
      ),
    ).toBe(true);
  });

  it("creates cross-game-link proposals only when multiple games are active", () => {
    const output = runPhase6Formalization(
      { subsections: ["6i"] },
      {
        canonical: createPhase6CanonicalStore(true),
        analysisState: createAnalysisState(
          "Parallel bargaining and alliance management games",
        ),
        baseRevision: 0,
        phaseExecution: createExecution(6),
        phaseResults: {},
      },
    );

    expect(output.cross_game_effects?.effects).toHaveLength(1);
    expect(
      output.proposals.some(
        (proposal) => proposal.proposal_type === "cross_game_link",
      ),
    ).toBe(true);
  });

  it("does not emit new_game_identified merely because multiple accepted games already exist", () => {
    const output = runPhase6Formalization(
      { subsections: ["6a"] },
      {
        canonical: createPhase6CanonicalStore(true),
        analysisState: createAnalysisState(
          "Parallel bargaining and alliance management games",
        ),
        baseRevision: 0,
        phaseExecution: createExecution(6),
        phaseResults: {
          4: createPhase4HistoryResult(),
        },
      },
    );

    expect(output.revalidation_signals.triggers_found).not.toContain(
      "new_game_identified",
    );
  });

  it("surfaces speculative overlay failures instead of silently analyzing canonical state", () => {
    vi.spyOn(dispatchModule, "dispatch").mockReturnValue({
      status: "rejected",
      reason: "error",
      errors: ["synthetic dry-run failure"],
    });

    const output = runPhase6Formalization(
      { subsections: ["6a", "6b", "6c"] },
      {
        canonical: createPhase6CanonicalStore(),
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

    expect(output.status.status).toBe("partial");
    expect(output.formal_representations.warnings[0]).toMatch(
      /speculative Phase 6 overlay/i,
    );
    expect(output.baseline_equilibria.status).toBe("partial");
    expect(output.baseline_equilibria.analyses).toHaveLength(0);
    expect(output.workspace_previews).toEqual({});
  });

  it("extracts phase 7 assumptions, flags inference-only critical support, and emits add/update proposals", () => {
    const canonical = createPhase7CanonicalStore();
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

    const output = runPhase7Assumptions({
      canonical,
      baseRevision: 0,
      phaseExecution: createExecution(7),
      getDerivedState: () => getDerivedStore().getState(),
      phaseResults: {
        4: createPhase4HistoryResult(),
        6: phase6,
      },
    });

    expect(
      new Set(output.assumptions.map((assumption) => assumption.type)),
    ).toEqual(
      new Set([
        "behavioral",
        "capability",
        "structural",
        "institutional",
        "rationality",
        "information",
      ]),
    );
    expect(
      output.assumptions.find(
        (assumption) => assumption.temp_id === "assumption_capability",
      )?.sensitivity,
    ).toBe("critical");
    expect(
      output.assumptions.find(
        (assumption) => assumption.temp_id === "assumption_capability",
      )?.evidence_quality,
    ).toBe("inference");
    expect(output.sensitivity_summary.inference_only_critical).toBeGreaterThan(
      0,
    );
    expect(output.correlated_clusters.length).toBeGreaterThan(0);
    expect(
      output.proposals.some((proposal) =>
        proposal.commands.some(
          (command) => command.kind === "update_assumption",
        ),
      ),
    ).toBe(true);
    expect(
      output.proposals.some((proposal) =>
        proposal.commands.some((command) => command.kind === "add_assumption"),
      ),
    ).toBe(true);
  });

  it("builds deterministic correlated clusters across repeated phase 7 runs", () => {
    const canonical = createPhase7CanonicalStore();
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

    const first = runPhase7Assumptions({
      canonical,
      baseRevision: 0,
      phaseExecution: createExecution(7),
      getDerivedState: () => getDerivedStore().getState(),
      phaseResults: {
        4: createPhase4HistoryResult(),
        6: phase6,
      },
    });
    const second = runPhase7Assumptions({
      canonical,
      baseRevision: 0,
      phaseExecution: createExecution(7),
      getDerivedState: () => getDerivedStore().getState(),
      phaseResults: {
        4: createPhase4HistoryResult(),
        6: phase6,
      },
    });

    expect(first.correlated_clusters).toEqual(second.correlated_clusters);
  });
});
