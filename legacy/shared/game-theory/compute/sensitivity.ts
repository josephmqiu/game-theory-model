import type { CanonicalStore } from "../types/canonical";
import type { EstimateValue } from "../types/estimates";
import type {
  ExtensiveFormModel,
  Formalization,
  NormalFormModel,
} from "../types/formalizations";
import type {
  AssumptionSensitivity,
  SensitivityAnalysis,
  SensitivitySummary,
  SolverResultUnion,
  ThresholdResult,
} from "../types/solver-results";
import { computeBayesianUpdate } from "./bayesian";
import { solveBackwardInduction } from "./backward-induction";
import { eliminateDominance } from "./dominance";
import { solveNash } from "./nash";
import { computeExpectedUtility } from "./expected-utility";
import {
  getFormalizationAssumptionIds,
  getFormalizationEdges,
  getFormalizationNodes,
  readEstimateNumeric,
} from "./utils";

const MAX_RERUNS = 480;

interface SensitivityTarget {
  parameter: string;
  playerId: string;
  currentValue: number;
  nodeId?: string;
  strategyProfile?: string[];
  linkedAssumptionIds: string[];
  stableMessage: string;
  crossedMessage: (thresholdValue: number) => string;
  buildStore: (nextValue: number) => CanonicalStore;
}

interface EvaluatedThreshold extends ThresholdResult {
  changed: boolean;
  linkedAssumptionIds: string[];
}

type SolverFingerprint = string;

function fingerprintResult(result: SolverResultUnion): SolverFingerprint {
  switch (result.solver) {
    case "nash":
      return JSON.stringify(
        result.equilibria.map((equilibrium) => ({
          type: equilibrium.type,
          strategies: equilibrium.strategies,
        })),
      );
    case "dominance":
      return JSON.stringify(result.eliminated_strategies);
    case "expected_utility":
      return JSON.stringify(
        Object.fromEntries(
          Object.entries(result.player_utilities).map(([playerId, utility]) => [
            playerId,
            utility.best_response,
          ]),
        ),
      );
    case "backward_induction":
      return JSON.stringify(result.solution_path);
    case "bayesian_update":
      return JSON.stringify(result.posterior_beliefs);
  }
}

function rerunSolver(
  formalization: Formalization,
  solver: SolverResultUnion["solver"],
  canonical: CanonicalStore,
): SolverResultUnion | null {
  switch (solver) {
    case "nash":
      return formalization.kind === "normal_form"
        ? solveNash(formalization, canonical)
        : null;
    case "dominance":
      return formalization.kind === "normal_form"
        ? eliminateDominance(formalization, canonical)
        : null;
    case "expected_utility":
      return formalization.kind === "normal_form"
        ? computeExpectedUtility(formalization, canonical)
        : null;
    case "backward_induction":
      return formalization.kind === "extensive_form"
        ? solveBackwardInduction(formalization, canonical)
        : null;
    case "bayesian_update":
      return formalization.kind === "bayesian"
        ? computeBayesianUpdate(formalization, canonical)
        : null;
  }
}

function withEstimateValue(
  estimate: EstimateValue,
  value: number,
): EstimateValue {
  return {
    ...estimate,
    value,
  };
}

function buildNormalFormTarget(
  canonical: CanonicalStore,
  formalization: NormalFormModel,
  cellIndex: number,
  playerId: string,
  rowStrategy: string,
  colStrategy: string,
  estimate: EstimateValue,
): SensitivityTarget | null {
  const numeric = readEstimateNumeric(estimate);
  if (!numeric) {
    return null;
  }

  const linkedAssumptionIds = [
    ...new Set([...formalization.assumptions, ...(estimate.assumptions ?? [])]),
  ];
  const strategyProfile = [rowStrategy, colStrategy];

  return {
    parameter: `${playerId}:${strategyProfile.join("|")}`,
    playerId,
    strategyProfile,
    currentValue: numeric.value,
    linkedAssumptionIds,
    stableMessage: "Result remained stable across tested perturbations.",
    crossedMessage: (thresholdValue) =>
      `Result changes when ${playerId} payoff at ${strategyProfile.join(" / ")} crosses ${thresholdValue.toFixed(2)}.`,
    buildStore: (nextValue) => ({
      ...canonical,
      formalizations: {
        ...canonical.formalizations,
        [formalization.id]: {
          ...formalization,
          payoff_cells: formalization.payoff_cells.map((cell, index) =>
            index === cellIndex
              ? {
                  ...cell,
                  payoffs: {
                    ...cell.payoffs,
                    [playerId]: withEstimateValue(estimate, nextValue),
                  },
                }
              : cell,
          ),
        },
      },
    }),
  };
}

function buildExtensiveFormTarget(
  canonical: CanonicalStore,
  formalization: ExtensiveFormModel,
  nodeId: string,
  nodeLabel: string,
  playerId: string,
  estimate: EstimateValue,
): SensitivityTarget | null {
  const numeric = readEstimateNumeric(estimate);
  if (!numeric) {
    return null;
  }

  const node = canonical.nodes[nodeId];
  const incomingEdges = getFormalizationEdges(
    canonical,
    formalization.id,
  ).filter((edge) => edge.to === nodeId);
  const linkedAssumptionIds = [
    ...new Set([
      ...formalization.assumptions,
      ...(node?.assumptions ?? []),
      ...incomingEdges.flatMap((edge) => edge.assumptions ?? []),
      ...(estimate.assumptions ?? []),
    ]),
  ];

  return {
    parameter: `${nodeId}:${playerId}`,
    playerId,
    nodeId,
    strategyProfile: [nodeLabel],
    currentValue: numeric.value,
    linkedAssumptionIds,
    stableMessage: "Solution path remained stable across tested perturbations.",
    crossedMessage: () =>
      `Changing terminal payoff at ${nodeLabel} flips the current solution path.`,
    buildStore: (nextValue) => ({
      ...canonical,
      nodes: {
        ...canonical.nodes,
        [nodeId]: node
          ? {
              ...node,
              terminal_payoffs: {
                ...(node.terminal_payoffs ?? {}),
                [playerId]: withEstimateValue(estimate, nextValue),
              },
            }
          : canonical.nodes[nodeId],
      },
    }),
  };
}

function buildSensitivityTargets(
  formalization: Formalization,
  canonical: CanonicalStore,
): SensitivityTarget[] {
  if (formalization.kind === "normal_form") {
    return formalization.payoff_cells.flatMap((cell, cellIndex) =>
      Object.entries(cell.payoffs)
        .map(([playerId, estimate]) =>
          buildNormalFormTarget(
            canonical,
            formalization,
            cellIndex,
            playerId,
            cell.strategy_profile[Object.keys(cell.strategy_profile)[0]!] ?? "",
            cell.strategy_profile[Object.keys(cell.strategy_profile)[1]!] ?? "",
            estimate,
          ),
        )
        .filter((target): target is SensitivityTarget => target !== null),
    );
  }

  if (formalization.kind === "extensive_form") {
    return getFormalizationNodes(canonical, formalization.id).flatMap((node) =>
      Object.entries(node.terminal_payoffs ?? {})
        .map(([playerId, estimate]) =>
          buildExtensiveFormTarget(
            canonical,
            formalization,
            node.id,
            node.label,
            playerId,
            estimate,
          ),
        )
        .filter((target): target is SensitivityTarget => target !== null),
    );
  }

  return [];
}

function computeMaxStepsPerDirection(targetCount: number): number {
  if (targetCount === 0) {
    return 0;
  }

  return Math.min(20, Math.max(4, Math.floor(MAX_RERUNS / (targetCount * 2))));
}

function computeStepSize(currentValue: number, targetCount: number): number {
  if (targetCount > 12) {
    return Math.max(Math.abs(currentValue) * 0.1, 0.5);
  }

  return Math.max(Math.abs(currentValue) * 0.05, 0.25);
}

function evaluateThreshold(
  target: SensitivityTarget,
  formalization: Formalization,
  solverResult: SolverResultUnion,
  baselineFingerprint: string,
  targetCount: number,
): EvaluatedThreshold {
  const maxStepsPerDirection = computeMaxStepsPerDirection(targetCount);
  const step = computeStepSize(target.currentValue, targetCount);

  let thresholdValue = target.currentValue;
  let changed = false;

  for (const deltaDirection of ["increase", "decrease"] as const) {
    for (let stepIndex = 1; stepIndex <= maxStepsPerDirection; stepIndex += 1) {
      const delta = step * stepIndex * (deltaDirection === "increase" ? 1 : -1);
      const nextValue = target.currentValue + delta;
      const nextStore = target.buildStore(nextValue);
      const nextFormalization = nextStore.formalizations[formalization.id];
      const rerun = nextFormalization
        ? rerunSolver(nextFormalization, solverResult.solver, nextStore)
        : null;

      if (rerun && fingerprintResult(rerun) !== baselineFingerprint) {
        thresholdValue = nextValue;
        changed = true;
        break;
      }
    }

    if (changed) {
      break;
    }
  }

  const margin = changed
    ? Math.abs(thresholdValue - target.currentValue)
    : step * Math.max(maxStepsPerDirection, 1);

  return {
    parameter: target.parameter,
    current: target.currentValue,
    threshold: thresholdValue,
    margin,
    consequence: changed
      ? "Solver conclusion changes."
      : "Solver conclusion remained stable.",
    changed,
    linkedAssumptionIds: target.linkedAssumptionIds,
  };
}

export function analyzeSensitivity(
  formalization: Formalization,
  solverResult: SolverResultUnion,
  canonical: CanonicalStore,
): SensitivityAnalysis {
  const targets = buildSensitivityTargets(formalization, canonical);
  const baselineFingerprint = fingerprintResult(solverResult);
  const thresholdEvaluations = targets
    .map((target) => ({
      target,
      threshold: evaluateThreshold(
        target,
        formalization,
        solverResult,
        baselineFingerprint,
        targets.length,
      ),
    }))
    .sort((left, right) => left.threshold.margin - right.threshold.margin);

  const payoffSensitivities = thresholdEvaluations.map(
    ({ target, threshold }) => ({
      player_id: target.playerId,
      node_id: target.nodeId,
      strategy_profile: target.strategyProfile,
      current_value: target.currentValue,
      threshold_value: threshold.threshold,
      margin: threshold.margin,
      direction:
        threshold.threshold >= target.currentValue
          ? ("increase" as const)
          : ("decrease" as const),
      result_if_crossed: threshold.changed
        ? target.crossedMessage(threshold.threshold)
        : target.stableMessage,
    }),
  );

  const thresholdAnalysis: ThresholdResult[] = thresholdEvaluations.map(
    ({ threshold }) => ({
      parameter: threshold.parameter,
      current: threshold.current,
      threshold: threshold.threshold,
      margin: threshold.margin,
      consequence: threshold.consequence,
    }),
  );

  const assumptionIds = [
    ...new Set([
      ...getFormalizationAssumptionIds(formalization, canonical),
      ...targets.flatMap((target) => target.linkedAssumptionIds),
    ]),
  ];
  const assumptionSensitivities: AssumptionSensitivity[] = assumptionIds.map(
    (assumptionId) => {
      const assumption = canonical.assumptions[assumptionId];
      const linkedEntries = thresholdEvaluations.filter(({ threshold }) =>
        threshold.linkedAssumptionIds.includes(assumptionId),
      );
      const changedEntries = linkedEntries.filter(
        ({ threshold }) => threshold.changed,
      );

      let description =
        "No analyzed payoff targets were linked to this assumption.";
      if (linkedEntries.length > 0) {
        description =
          changedEntries.length > 0
            ? "At least one linked payoff threshold flips the current solver conclusion."
            : "Linked payoff perturbations remained stable across the bounded sensitivity search.";
      }

      return {
        assumption_id: assumptionId,
        statement: assumption?.statement ?? assumptionId,
        impact: changedEntries.length > 0 ? "result_changes" : "result_stable",
        description,
        affected_payoffs: linkedEntries.map(
          ({ threshold }) => threshold.parameter,
        ),
      };
    },
  );

  const smallestMargin = payoffSensitivities[0]?.margin ?? 0;
  const baseline = Math.max(
    Math.abs(payoffSensitivities[0]?.current_value ?? 1),
    1,
  );
  const ratio = baseline === 0 ? 0 : smallestMargin / baseline;
  const overallRobustness =
    payoffSensitivities.length === 0
      ? "robust"
      : ratio > 0.2
        ? "robust"
        : ratio >= 0.05
          ? "sensitive"
          : "fragile";

  return {
    formalization_id: formalization.id,
    solver: solverResult.solver,
    solver_result_id: solverResult.id,
    computed_at: new Date().toISOString(),
    payoff_sensitivities: payoffSensitivities,
    assumption_sensitivities: assumptionSensitivities,
    threshold_analysis: thresholdAnalysis,
    overall_robustness: overallRobustness,
  };
}

export function buildSensitivitySummary(
  analysis: SensitivityAnalysis,
): SensitivitySummary {
  const mostSensitive = analysis.payoff_sensitivities[0] ?? null;
  return {
    most_sensitive_payoff: mostSensitive
      ? {
          player_id: mostSensitive.player_id,
          strategy_profile: mostSensitive.strategy_profile ?? [
            mostSensitive.node_id ?? "unknown",
          ],
          sensitivity_magnitude: mostSensitive.margin,
        }
      : null,
    result_change_threshold: mostSensitive?.threshold_value ?? 0,
    assumption_sensitivity: analysis.assumption_sensitivities.map((entry) => ({
      assumption_id: entry.assumption_id,
      impact: entry.impact,
      description: entry.description,
    })),
  };
}
