import { describe, expect, it } from "vitest";

import { computeBayesianUpdate } from "./bayesian";
import { solveBackwardInduction } from "./backward-induction";
import { eliminateDominance } from "./dominance";
import { solveNash } from "./nash";
import { computeExpectedUtility } from "./expected-utility";
import { analyzeSensitivity } from "./sensitivity";
import {
  createBayesianStore,
  createEstimate,
  createExtensiveFormStore,
  createNormalFormStore,
} from "../test-support/m4-fixtures";
import type {
  BayesianGameModel,
  ExtensiveFormModel,
  NormalFormModel,
} from "../types/formalizations";

describe("M4 solvers", () => {
  it("finds the pure Nash equilibrium in prisoners dilemma", () => {
    const store = createNormalFormStore();
    const formalization = store.formalizations
      .formalization_1 as NormalFormModel;

    const result = solveNash(formalization, store);

    expect(result.status).toBe("success");
    expect(
      result.equilibria.some(
        (equilibrium) => equilibrium.id === "Defect__Defect",
      ),
    ).toBe(true);
  });

  it("eliminates dominated strategies across rounds", () => {
    const baseStore = createNormalFormStore();
    const formalization = baseStore.formalizations
      .formalization_1 as NormalFormModel;
    const store = {
      ...baseStore,
      formalizations: {
        ...baseStore.formalizations,
        formalization_1: {
          ...formalization,
          strategies: {
            ...formalization.strategies,
            player_1: [...formalization.strategies.player_1, "Worse"],
          },
          payoff_cells: [
            ...formalization.payoff_cells,
            {
              strategy_profile: { player_1: "Worse", player_2: "Cooperate" },
              payoffs: {
                player_1: createEstimate(-1),
                player_2: createEstimate(2),
              },
            },
            {
              strategy_profile: { player_1: "Worse", player_2: "Defect" },
              payoffs: {
                player_1: createEstimate(-2),
                player_2: createEstimate(1),
              },
            },
          ],
        },
      },
    };

    const result = eliminateDominance(
      store.formalizations.formalization_1 as NormalFormModel,
      store,
    );

    expect(
      result.eliminated_strategies.some((entry) => entry.strategy === "Worse"),
    ).toBe(true);
    expect(result.rounds.length).toBeGreaterThan(0);
  });

  it("computes expected utility with uniform fallback", () => {
    const store = createNormalFormStore();
    const formalization = store.formalizations
      .formalization_1 as NormalFormModel;

    const result = computeExpectedUtility(formalization, store);

    expect(result.status).toBe("success");
    expect(result.warnings.join(" ")).toContain("uniform distribution");
    expect(result.player_utilities.player_1.best_response).toBe("Defect");
  });

  it("solves backward induction on a simple tree", () => {
    const store = createExtensiveFormStore();
    const formalization = store.formalizations
      .formalization_1 as ExtensiveFormModel;

    const result = solveBackwardInduction(formalization, store);

    expect(result.status).toBe("success");
    expect(result.solution_path).toEqual(["edge_left"]);
  });

  it("fails backward induction cleanly when the extensive-form graph contains a reachable cycle", () => {
    const baseStore = createExtensiveFormStore();
    const formalization = baseStore.formalizations
      .formalization_1 as ExtensiveFormModel;
    const store = {
      ...baseStore,
      nodes: {
        ...baseStore.nodes,
        node_right: {
          ...baseStore.nodes.node_right,
          type: "decision" as const,
          actor: { kind: "player" as const, player_id: "player_1" },
          available_actions: ["Loop"],
          terminal_payoffs: undefined,
        },
      },
      edges: {
        ...baseStore.edges,
        edge_cycle: {
          id: "edge_cycle",
          formalization_id: "formalization_1",
          from: "node_right",
          to: "node_root",
          label: "Loop",
          action_id: "loop",
        },
      },
      formalizations: {
        ...baseStore.formalizations,
        formalization_1: {
          ...formalization,
        },
      },
    };

    const result = solveBackwardInduction(
      store.formalizations.formalization_1 as ExtensiveFormModel,
      store,
    );

    expect(result.status).toBe("failed");
    expect(result.error).toContain("acyclic");
  });

  it("computes Bayesian posterior shifts", () => {
    const store = createBayesianStore();
    const formalization = store.formalizations
      .formalization_1 as BayesianGameModel;

    const result = computeBayesianUpdate(formalization, store);

    expect(result.status).toBe("success");
    const toughPosterior = result.posterior_beliefs.find(
      (belief) =>
        belief.type_label === "tough" && belief.evidence_used[0] === "hawkish",
    );
    expect(toughPosterior?.posterior).toBeGreaterThan(0.5);
  });

  it("chains Bayesian posteriors across sequential observations", () => {
    const baseStore = createBayesianStore();
    const formalization = baseStore.formalizations
      .formalization_1 as BayesianGameModel;
    const existingSignals = formalization.signal_structure?.signals ?? [];
    const store = {
      ...baseStore,
      formalizations: {
        ...baseStore.formalizations,
        formalization_1: {
          ...formalization,
          signal_structure: {
            signals: [
              ...existingSignals,
              { label: "dovish", type_label: "tough", probability: 0.2 },
              { label: "dovish", type_label: "soft", probability: 0.8 },
            ],
          },
        },
      },
    };

    const result = computeBayesianUpdate(
      store.formalizations.formalization_1 as BayesianGameModel,
      store,
    );

    expect(result.status).toBe("success");
    expect(result.update_chain).toHaveLength(2);
    expect(result.update_chain[1]?.prior.tough).toBeCloseTo(0.8, 8);

    const finalToughBelief = result.posterior_beliefs.find(
      (belief) =>
        belief.type_label === "tough" &&
        belief.evidence_used.join(",") === "hawkish,dovish",
    );

    expect(finalToughBelief?.prior).toBeCloseTo(0.8, 8);
    expect(finalToughBelief?.posterior).toBeCloseTo(0.5, 8);
  });

  it("returns partial Bayesian results when one observation branch is invalid", () => {
    const baseStore = createBayesianStore();
    const formalization = baseStore.formalizations
      .formalization_1 as BayesianGameModel;
    const existingSignals = formalization.signal_structure?.signals ?? [];
    const store = {
      ...baseStore,
      formalizations: {
        ...baseStore.formalizations,
        formalization_1: {
          ...formalization,
          signal_structure: {
            signals: [
              ...existingSignals,
              { label: "impossible", type_label: "tough", probability: 0 },
              { label: "impossible", type_label: "soft", probability: 0 },
            ],
          },
        },
      },
    };

    const result = computeBayesianUpdate(
      store.formalizations.formalization_1 as BayesianGameModel,
      store,
    );

    expect(result.status).toBe("partial");
    expect(result.warnings.join(" ")).toContain("skipped");
    expect(
      result.posterior_beliefs.some(
        (belief) => belief.evidence_used[0] === "hawkish",
      ),
    ).toBe(true);
  });

  it("fails Bayesian updates when every observation branch is invalid", () => {
    const baseStore = createBayesianStore();
    const formalization = baseStore.formalizations
      .formalization_1 as BayesianGameModel;
    const store = {
      ...baseStore,
      formalizations: {
        ...baseStore.formalizations,
        formalization_1: {
          ...formalization,
          signal_structure: {
            signals: [
              { label: "impossible", type_label: "tough", probability: 0 },
              { label: "impossible", type_label: "soft", probability: 0 },
            ],
          },
        },
      },
    };

    const result = computeBayesianUpdate(
      store.formalizations.formalization_1 as BayesianGameModel,
      store,
    );

    expect(result.status).toBe("failed");
    expect(result.error).toContain("All configured observations");
  });

  it("renormalizes posteriors after clamping", () => {
    const baseStore = createBayesianStore();
    const formalization = baseStore.formalizations
      .formalization_1 as BayesianGameModel;
    const store = {
      ...baseStore,
      formalizations: {
        ...baseStore.formalizations,
        formalization_1: {
          ...formalization,
          signal_structure: {
            signals: [
              { label: "needle", type_label: "tough", probability: 1 },
              { label: "needle", type_label: "soft", probability: 1e-16 },
            ],
          },
        },
      },
    };

    const result = computeBayesianUpdate(
      store.formalizations.formalization_1 as BayesianGameModel,
      store,
    );
    const needleBeliefs = result.posterior_beliefs.filter(
      (belief) => belief.evidence_used[0] === "needle",
    );
    const totalPosterior = needleBeliefs.reduce(
      (sum, belief) => sum + belief.posterior,
      0,
    );

    expect(result.warnings.join(" ")).toContain("numerical precision");
    expect(totalPosterior).toBeCloseTo(1, 8);
  });

  it("skips mixed-strategy search outside 2x2 games with a warning", () => {
    const baseStore = createNormalFormStore();
    const formalization = baseStore.formalizations
      .formalization_1 as NormalFormModel;
    const store = {
      ...baseStore,
      formalizations: {
        ...baseStore.formalizations,
        formalization_1: {
          ...formalization,
          strategies: {
            ...formalization.strategies,
            player_1: [...formalization.strategies.player_1, "Delay"],
          },
          payoff_cells: [
            ...formalization.payoff_cells,
            {
              strategy_profile: { player_1: "Delay", player_2: "Cooperate" },
              payoffs: {
                player_1: createEstimate(2),
                player_2: createEstimate(4),
              },
            },
            {
              strategy_profile: { player_1: "Delay", player_2: "Defect" },
              payoffs: {
                player_1: createEstimate(0.5),
                player_2: createEstimate(1.5),
              },
            },
          ],
        },
      },
    };

    const result = solveNash(
      store.formalizations.formalization_1 as NormalFormModel,
      store,
    );

    expect(result.status).toBe("success");
    expect(result.warnings.join(" ")).toContain(
      "Mixed-strategy search is limited to 2x2 games",
    );
    expect(
      result.equilibria.every((equilibrium) => equilibrium.type === "pure"),
    ).toBe(true);
  });

  it("produces a sensitivity analysis for Nash results", () => {
    const store = createNormalFormStore();
    const formalization = store.formalizations
      .formalization_1 as NormalFormModel;
    const result = solveNash(formalization, store);
    const sensitivity = analyzeSensitivity(formalization, result, store);

    expect(sensitivity.payoff_sensitivities.length).toBeGreaterThan(0);
    expect(["robust", "sensitive", "fragile"]).toContain(
      sensitivity.overall_robustness,
    );
  });

  it("marks only linked assumptions as result-changing in sensitivity analysis", () => {
    const baseStore = createNormalFormStore();
    const formalization = baseStore.formalizations
      .formalization_1 as NormalFormModel;
    const changingEstimate = {
      ...formalization.payoff_cells[1]!.payoffs.player_1,
      assumptions: ["assumption_1"],
    };
    const stableEstimate = {
      ...formalization.payoff_cells[2]!.payoffs.player_1,
      assumptions: ["assumption_2"],
    };
    const store = {
      ...baseStore,
      assumptions: {
        ...baseStore.assumptions,
        assumption_2: {
          ...baseStore.assumptions.assumption_1,
          id: "assumption_2",
          statement: "Noise assumption.",
        },
      },
      formalizations: {
        ...baseStore.formalizations,
        formalization_1: {
          ...formalization,
          assumptions: [],
          payoff_cells: formalization.payoff_cells.map((cell, index) =>
            index === 1
              ? {
                  ...cell,
                  payoffs: {
                    ...cell.payoffs,
                    player_1: changingEstimate,
                  },
                }
              : index === 2
                ? {
                    ...cell,
                    payoffs: {
                      ...cell.payoffs,
                      player_1: stableEstimate,
                    },
                  }
                : cell,
          ),
        },
      },
    };
    const result = solveNash(
      store.formalizations.formalization_1 as NormalFormModel,
      store,
    );
    const sensitivity = analyzeSensitivity(
      store.formalizations.formalization_1 as NormalFormModel,
      result,
      store,
    );

    expect(
      sensitivity.assumption_sensitivities.find(
        (entry) => entry.assumption_id === "assumption_1",
      )?.impact,
    ).toBe("result_changes");
    expect(
      sensitivity.assumption_sensitivities.find(
        (entry) => entry.assumption_id === "assumption_2",
      )?.impact,
    ).toBe("result_stable");
  });

  it("keeps sensitivity analysis bounded on larger games", () => {
    const baseStore = createNormalFormStore();
    const formalization = baseStore.formalizations
      .formalization_1 as NormalFormModel;
    const strategies = ["Cooperate", "Defect", "Delay", "Signal"];
    const payoffCells = strategies.flatMap((rowStrategy, rowIndex) =>
      strategies.map((colStrategy, colIndex) => ({
        strategy_profile: { player_1: rowStrategy, player_2: colStrategy },
        payoffs: {
          player_1: createEstimate(rowIndex - colIndex + 2),
          player_2: createEstimate(colIndex - rowIndex + 2),
        },
      })),
    );
    const store = {
      ...baseStore,
      formalizations: {
        ...baseStore.formalizations,
        formalization_1: {
          ...formalization,
          strategies: {
            player_1: strategies,
            player_2: strategies,
          },
          payoff_cells: payoffCells,
        },
      },
    };
    const result = solveNash(
      store.formalizations.formalization_1 as NormalFormModel,
      store,
    );
    const sensitivity = analyzeSensitivity(
      store.formalizations.formalization_1 as NormalFormModel,
      result,
      store,
    );

    expect(sensitivity.threshold_analysis.length).toBe(payoffCells.length * 2);
    expect(
      sensitivity.threshold_analysis.every((entry) => entry.margin >= 0),
    ).toBe(true);
  });

  it("returns backward-induction metadata immutably for weighted beliefs", () => {
    const baseStore = createExtensiveFormStore();
    const formalization = baseStore.formalizations
      .formalization_1 as ExtensiveFormModel;
    const store = {
      ...baseStore,
      formalizations: {
        ...baseStore.formalizations,
        formalization_1: {
          ...formalization,
          information_sets: [
            {
              id: "info_1",
              player_id: "player_1",
              node_ids: ["node_root"],
              beliefs: { node_root: 1 },
            },
          ],
        },
      },
      nodes: {
        ...baseStore.nodes,
        node_root: {
          ...baseStore.nodes.node_root,
          information_set_id: "info_1",
        },
      },
    };

    const result = solveBackwardInduction(
      store.formalizations.formalization_1 as ExtensiveFormModel,
      store,
    );

    expect(result.meta.method_id).toBe("backward_induction_weighted_belief");
    expect(result.meta.limitations).toEqual([]);
  });
});
