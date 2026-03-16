import type { Command } from "../engine/commands";
import type { CanonicalStore, EntityRef } from "../types";
import type { ForecastEstimate } from "../types/estimates";
import type {
  AssumptionExtractionResult,
  EliminationResult,
  ForecastBasis,
  FormalizationResult,
  ModelProposal,
  PhaseExecution,
  PhaseResult,
  ProposedCentralThesis,
  ProposedScenarioFull,
  ProposedTailRisk,
  ScenarioAssumptionRef,
  ScenarioCausalStep,
  ScenarioGenerationResult,
  ScenarioProbabilityCheck,
} from "../types/analysis-pipeline";
import {
  asEntityRef,
  buildModelProposal,
  createEntityId,
  createEntityPreview,
} from "./helpers";

interface Phase9RunnerContext {
  canonical: CanonicalStore;
  baseRevision: number;
  phaseExecution: PhaseExecution;
  phaseResults?: Record<number, unknown>;
}

function getFormalizationResult(
  phaseResults?: Record<number, unknown>,
): FormalizationResult | null {
  const result = phaseResults?.[6];
  return result &&
    typeof result === "object" &&
    "phase" in result &&
    result.phase === 6
    ? (result as FormalizationResult)
    : null;
}

function getAssumptionResult(
  phaseResults?: Record<number, unknown>,
): AssumptionExtractionResult | null {
  const result = phaseResults?.[7];
  return result &&
    typeof result === "object" &&
    "phase" in result &&
    result.phase === 7
    ? (result as AssumptionExtractionResult)
    : null;
}

function getEliminationResult(
  phaseResults?: Record<number, unknown>,
): EliminationResult | null {
  const result = phaseResults?.[8];
  return result &&
    typeof result === "object" &&
    "phase" in result &&
    result.phase === 8
    ? (result as EliminationResult)
    : null;
}

function makeForecastEstimate(
  value: number,
  rationale: string,
  assumptions: string[] = [],
): ForecastEstimate {
  return {
    mode: "point",
    value,
    confidence: Math.min(Math.max(value, 0.1), 0.95),
    rationale,
    source_claims: ["Heuristic scenario generation runner"],
    assumptions,
  };
}

function determineForecastBasis(
  formalizationId: string,
  phase6: FormalizationResult,
): ForecastBasis {
  const analysis = phase6.baseline_equilibria.analyses.find(
    (entry) => entry.formalization_id === formalizationId,
  );
  if (!analysis) {
    return "discretionary";
  }

  const solverRan = analysis.solver_summaries.some(
    (summary) => summary.status === "success" || summary.status === "partial",
  );
  return solverRan ? "equilibrium" : "discretionary";
}

function findAssumptionRefsForFormalization(
  formalizationId: string,
  canonical: CanonicalStore,
  phase7: AssumptionExtractionResult | null,
): ScenarioAssumptionRef[] {
  const formalization = canonical.formalizations[formalizationId];
  if (!formalization) {
    return [];
  }

  const formalizationAssumptionIds = new Set(formalization.assumptions);
  const gameAssumptionIds = new Set(
    canonical.games[formalization.game_id]?.key_assumptions ?? [],
  );
  const relevantIds = new Set([
    ...formalizationAssumptionIds,
    ...gameAssumptionIds,
  ]);

  if (!phase7 || relevantIds.size === 0) {
    return [...relevantIds].map((id) => ({
      assumption_ref: asEntityRef("assumption", id),
      sensitivity: (canonical.assumptions[id]?.sensitivity ??
        "medium") as ScenarioAssumptionRef["sensitivity"],
    }));
  }

  return phase7.assumptions
    .filter((assumption) => relevantIds.has(assumption.temp_id))
    .map((assumption) => ({
      assumption_ref: asEntityRef("assumption", assumption.temp_id),
      sensitivity: assumption.sensitivity,
    }));
}

function deriveInvalidationConditions(
  assumptionRefs: ScenarioAssumptionRef[],
  phase7: AssumptionExtractionResult | null,
  canonical: CanonicalStore,
): string[] {
  const criticalRefs = assumptionRefs.filter(
    (ref) => ref.sensitivity === "critical" || ref.sensitivity === "high",
  );

  return criticalRefs.map((ref) => {
    const assumptionId = ref.assumption_ref.id;
    const phase7Assumption = phase7?.assumptions.find(
      (a) => a.temp_id === assumptionId,
    );
    if (phase7Assumption) {
      return phase7Assumption.what_if_wrong;
    }
    const canonicalAssumption = canonical.assumptions[assumptionId];
    return canonicalAssumption
      ? `Assumption violated: "${canonicalAssumption.statement}"`
      : `Assumption ${assumptionId} no longer holds`;
  });
}

function findCrossGameInteractions(
  gameId: string,
  canonical: CanonicalStore,
): EntityRef[] {
  return Object.values(canonical.cross_game_links)
    .filter(
      (link) =>
        link.source_game_id === gameId || link.target_game_id === gameId,
    )
    .map((link) => asEntityRef("cross_game_link", link.id));
}

function buildCausalChain(
  game: CanonicalStore["games"][string],
  formalization: CanonicalStore["formalizations"][string],
): ScenarioCausalStep[] {
  const steps: ScenarioCausalStep[] = [
    {
      phase: "Initial conditions",
      event: `Strategic game "${game.name}" is active with ${game.players.length} players`,
      leads_to: "Players evaluate available strategies",
    },
    {
      phase: "Strategy selection",
      event: `Players choose from ${formalization.kind} representation`,
      leads_to: "Equilibrium path emerges",
    },
    {
      phase: "Outcome",
      event: "Equilibrium path determines expected outcome",
      leads_to: "Scenario realization",
    },
  ];
  return steps;
}

function estimateProbability(
  formalizationId: string,
  phase6: FormalizationResult,
  gameCount: number,
): number {
  const analysis = phase6.baseline_equilibria.analyses.find(
    (entry) => entry.formalization_id === formalizationId,
  );

  const baseConfidence = analysis
    ? analysis.readiness.completeness_score *
      analysis.readiness.confidence_floor
    : 0.3;

  const adjustedForCount =
    gameCount > 1 ? baseConfidence / gameCount : baseConfidence;

  return Math.max(0.05, Math.min(0.95, adjustedForCount));
}

function buildScenarios(
  canonical: CanonicalStore,
  phase6: FormalizationResult,
  phase7: AssumptionExtractionResult | null,
): ProposedScenarioFull[] {
  const scenarios: ProposedScenarioFull[] = [];
  const gamesWithFormalizations = Object.values(canonical.games).filter(
    (game) => game.formalizations.length > 0,
  );

  for (const game of gamesWithFormalizations) {
    const formalizationId = game.formalizations[0]!;
    const formalization = canonical.formalizations[formalizationId];
    if (!formalization) {
      continue;
    }

    const causalChain = buildCausalChain(game, formalization);
    const summary = `Equilibrium-path scenario for "${game.name}": ${game.description}`;
    const fullText = [
      summary,
      ...causalChain.map(
        (step) => `${step.phase}: ${step.event} -> ${step.leads_to}`,
      ),
    ].join("\n");

    const probabilityValue = estimateProbability(
      formalizationId,
      phase6,
      gamesWithFormalizations.length,
    );
    const assumptionIds = [
      ...formalization.assumptions,
      ...(canonical.games[game.id]?.key_assumptions ?? []),
    ];
    const probability = makeForecastEstimate(
      probabilityValue,
      `Derived from formalization readiness and equilibrium analysis for "${game.name}"`,
      assumptionIds,
    );

    const keyAssumptions = findAssumptionRefsForFormalization(
      formalizationId,
      canonical,
      phase7,
    );
    const invalidationConditions = deriveInvalidationConditions(
      keyAssumptions,
      phase7,
      canonical,
    );
    const modelBasis: EntityRef[] = [
      asEntityRef("game", game.id),
      asEntityRef("formalization", formalizationId),
    ];
    const crossGameInteractions = findCrossGameInteractions(game.id, canonical);
    const forecastBasis = determineForecastBasis(formalizationId, phase6);

    scenarios.push({
      temp_id: createEntityId("scenario"),
      name: `${game.name} — equilibrium path`,
      narrative: {
        summary,
        causal_chain: causalChain,
        full_text: fullText,
      },
      probability,
      key_assumptions: keyAssumptions,
      invalidation_conditions: invalidationConditions,
      model_basis: modelBasis,
      cross_game_interactions: crossGameInteractions,
      forecast_basis: forecastBasis,
      forecast_basis_explanation:
        forecastBasis === "equilibrium"
          ? `Probability derived from Phase 6 solver results for formalization ${formalizationId}`
          : `Probability estimated heuristically; no solver results available for formalization ${formalizationId}`,
    });
  }

  return scenarios;
}

function buildCentralThesis(
  scenarios: ProposedScenarioFull[],
  _phase7: AssumptionExtractionResult | null,
): ProposedCentralThesis {
  if (scenarios.length === 0) {
    return {
      statement: "Insufficient data to form a central thesis.",
      falsification_condition:
        "Any structured scenario emerges from the model.",
      evidence_refs: [],
      assumption_refs: [],
      scenario_refs: [],
      forecast_basis: "discretionary",
    };
  }

  const sortedScenarios = [...scenarios].sort(
    (a, b) => (b.probability.value ?? 0) - (a.probability.value ?? 0),
  );
  const topScenario = sortedScenarios[0]!;

  const statement = `The most likely outcome path is: ${topScenario.narrative.summary}`;
  const falsificationCondition =
    topScenario.invalidation_conditions[0] ??
    `The scenario "${topScenario.name}" is contradicted by observed events.`;

  const evidenceRefs = topScenario.model_basis;
  const assumptionRefs = topScenario.key_assumptions.map(
    (ref) => ref.assumption_ref,
  );
  const scenarioRefs = scenarios.map((s) => s.temp_id);

  const forecastBasis: ForecastBasis = scenarios.every(
    (s) => s.forecast_basis === "equilibrium",
  )
    ? "equilibrium"
    : scenarios.every((s) => s.forecast_basis === "discretionary")
      ? "discretionary"
      : "mixed";

  return {
    statement,
    falsification_condition: falsificationCondition,
    evidence_refs: evidenceRefs,
    assumption_refs: assumptionRefs,
    scenario_refs: scenarioRefs,
    forecast_basis: forecastBasis,
  };
}

function buildTailRisks(
  canonical: CanonicalStore,
  phase7: AssumptionExtractionResult | null,
): ProposedTailRisk[] {
  if (!phase7) {
    return [];
  }

  const criticalLowConfidence = phase7.assumptions.filter(
    (assumption) =>
      assumption.sensitivity === "critical" &&
      assumption.confidence.confidence < 0.5,
  );

  return criticalLowConfidence.map((assumption) => {
    const hasContradiction = isContradicted(assumption.temp_id, canonical);

    const driftEvidence = hasContradiction
      ? `Contradicting evidence exists in the canonical model for assumption "${assumption.statement}"`
      : null;

    return {
      temp_id: createEntityId("tail_risk"),
      event_description: assumption.what_if_wrong,
      probability: makeForecastEstimate(
        Math.max(0.05, 1 - assumption.confidence.confidence),
        `Inverse of assumption confidence for "${assumption.statement}"`,
        [assumption.temp_id],
      ),
      trigger: `The assumption "${assumption.statement}" is falsified`,
      why_unlikely: assumption.statement,
      consequences: `Affected conclusions: ${assumption.affected_conclusions.map((ref) => `${ref.type}:${ref.id}`).join(", ") || "model-wide impact"}`,
      drift_toward: hasContradiction,
      drift_evidence: driftEvidence,
    };
  });
}

function isContradicted(
  assumptionId: string,
  canonical: CanonicalStore,
): boolean {
  const assumption = canonical.assumptions[assumptionId];
  if (
    assumption &&
    Array.isArray(assumption.contradicted_by) &&
    assumption.contradicted_by.length > 0
  ) {
    return true;
  }

  return Object.values(canonical.contradictions).some(
    (contradiction) =>
      contradiction.left_ref === assumptionId ||
      contradiction.right_ref === assumptionId,
  );
}

function checkProbabilities(
  scenarios: ProposedScenarioFull[],
): ScenarioProbabilityCheck {
  const sum = scenarios.reduce(
    (total, scenario) => total + (scenario.probability.value ?? 0),
    0,
  );
  const sumPercent = sum * 100;
  const missingProbability = Math.max(0, 1 - sum);

  const warning =
    sumPercent < 80
      ? `Scenario probability sum (${sumPercent.toFixed(1)}%) is below 80%. Consider adding more scenarios to cover the outcome space.`
      : sumPercent > 120
        ? `Scenario probability sum (${sumPercent.toFixed(1)}%) exceeds 120%. Scenarios may be overlapping or probabilities are overestimated.`
        : null;

  return {
    sum: Number(sum.toFixed(4)),
    missing_probability: Number(missingProbability.toFixed(4)),
    warning,
  };
}

function buildScenarioProposals(
  scenarios: ProposedScenarioFull[],
  context: Phase9RunnerContext,
): ModelProposal[] {
  return scenarios.map((scenario) => {
    const commands: Command[] = [
      {
        kind: "add_scenario",
        id: scenario.temp_id,
        payload: {
          name: scenario.name,
          formalization_id:
            scenario.model_basis.find((ref) => ref.type === "formalization")
              ?.id ?? "",
          path: scenario.narrative.causal_chain.map((step) => step.event),
          probability_model: "dependency_aware",
          estimated_probability: scenario.probability,
          key_assumptions: scenario.key_assumptions.map(
            (ref) => ref.assumption_ref.id,
          ),
          invalidators: scenario.invalidation_conditions,
          narrative: scenario.narrative.full_text,
          forecast_basis: scenario.forecast_basis,
          invalidation_conditions: scenario.invalidation_conditions,
          model_basis: scenario.model_basis,
          cross_game_interactions: scenario.cross_game_interactions,
        },
      },
    ];

    return buildModelProposal({
      description: `Add scenario: ${scenario.name}`,
      phase: 9,
      proposal_type: "scenario",
      phaseExecution: context.phaseExecution,
      baseRevision: context.baseRevision,
      commands,
      entity_previews: [
        createEntityPreview("scenario", "add", scenario.temp_id, {
          name: scenario.name,
          narrative_summary: scenario.narrative.summary,
          probability: scenario.probability.value,
          forecast_basis: scenario.forecast_basis,
        }),
      ],
    });
  });
}

function buildTailRiskProposals(
  tailRisks: ProposedTailRisk[],
  scenarios: ProposedScenarioFull[],
  context: Phase9RunnerContext,
): ModelProposal[] {
  return tailRisks.map((risk) => {
    const relatedScenarioRefs: EntityRef[] = scenarios.map((s) =>
      asEntityRef("scenario", s.temp_id),
    );

    const commands: Command[] = [
      {
        kind: "add_tail_risk",
        id: risk.temp_id,
        payload: {
          event_description: risk.event_description,
          probability: risk.probability,
          trigger: risk.trigger,
          why_unlikely: risk.why_unlikely,
          consequences: risk.consequences,
          drift_toward: risk.drift_toward,
          drift_evidence: risk.drift_evidence,
          related_scenarios: relatedScenarioRefs,
          evidence_refs: [],
        },
      },
    ];

    return buildModelProposal({
      description: `Add tail risk: ${risk.event_description}`,
      phase: 9,
      proposal_type: "scenario",
      phaseExecution: context.phaseExecution,
      baseRevision: context.baseRevision,
      commands,
      entity_previews: [
        createEntityPreview("tail_risk", "add", risk.temp_id, {
          event_description: risk.event_description,
          probability: risk.probability.value,
          drift_toward: risk.drift_toward,
        }),
      ],
    });
  });
}

function buildThesisProposal(
  thesis: ProposedCentralThesis,
  context: Phase9RunnerContext,
): ModelProposal {
  const thesisId = createEntityId("central_thesis");
  const scenarioEntityRefs: EntityRef[] = thesis.scenario_refs.map((tempId) =>
    asEntityRef("scenario", tempId),
  );

  const commands: Command[] = [
    {
      kind: "add_central_thesis",
      id: thesisId,
      payload: {
        statement: thesis.statement,
        falsification_condition: thesis.falsification_condition,
        evidence_refs: thesis.evidence_refs,
        assumption_refs: thesis.assumption_refs,
        scenario_refs: scenarioEntityRefs,
        forecast_basis: thesis.forecast_basis,
      },
    },
  ];

  return buildModelProposal({
    description: `Add central thesis: ${thesis.statement.slice(0, 80)}`,
    phase: 9,
    proposal_type: "thesis",
    phaseExecution: context.phaseExecution,
    baseRevision: context.baseRevision,
    commands,
    entity_previews: [
      createEntityPreview("central_thesis", "add", thesisId, {
        statement: thesis.statement,
        falsification_condition: thesis.falsification_condition,
        forecast_basis: thesis.forecast_basis,
      }),
    ],
  });
}

export function runPhase9Scenarios(
  context: Phase9RunnerContext,
): ScenarioGenerationResult {
  const phase6 = getFormalizationResult(context.phaseResults);
  const phase7 = getAssumptionResult(context.phaseResults);
  const _phase8 = getEliminationResult(context.phaseResults);

  if (!phase6) {
    const emptyThesis: ProposedCentralThesis = {
      statement: "Phase 6 results unavailable; no thesis can be formed.",
      falsification_condition:
        "Phase 6 formalization results become available.",
      evidence_refs: [],
      assumption_refs: [],
      scenario_refs: [],
      forecast_basis: "discretionary",
    };

    const status: PhaseResult = {
      status: "partial",
      phase: 9,
      execution_id: context.phaseExecution.id,
      retriable: true,
      gaps: [
        "Phase 6 formalization results are not available; scenario generation requires equilibrium analysis.",
      ],
    };

    return {
      phase: 9,
      status,
      proposed_scenarios: [],
      tail_risks: [],
      central_thesis: emptyThesis,
      probability_check: { sum: 0, missing_probability: 1, warning: null },
      proposals: [],
    };
  }

  const scenarios = buildScenarios(context.canonical, phase6, phase7);
  const centralThesis = buildCentralThesis(scenarios, phase7);
  const tailRisks = buildTailRisks(context.canonical, phase7);
  const probabilityCheck = checkProbabilities(scenarios);

  const scenarioProposals = buildScenarioProposals(scenarios, context);
  const tailRiskProposals = buildTailRiskProposals(
    tailRisks,
    scenarios,
    context,
  );
  const thesisProposal = buildThesisProposal(centralThesis, context);

  const proposals = [
    ...scenarioProposals,
    ...tailRiskProposals,
    thesisProposal,
  ];

  const gaps: string[] = [];
  if (scenarios.length === 0) {
    gaps.push(
      "No games with formalizations were found; no scenarios could be generated.",
    );
  }
  if (!phase7) {
    gaps.push(
      "Phase 7 assumption results are not available; tail risk identification was skipped.",
    );
  }
  if (!_phase8) {
    gaps.push(
      "Phase 8 elimination results are not available; eliminated outcomes were not factored in.",
    );
  }

  const status: PhaseResult = {
    status: "complete",
    phase: 9,
    execution_id: context.phaseExecution.id,
    retriable: true,
    gaps: gaps.length > 0 ? gaps : undefined,
  };

  return {
    phase: 9,
    status,
    proposed_scenarios: scenarios,
    tail_risks: tailRisks,
    central_thesis: centralThesis,
    probability_check: probabilityCheck,
    proposals,
  };
}
