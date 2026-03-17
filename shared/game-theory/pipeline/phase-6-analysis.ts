import { computeBayesianUpdate } from "../compute/bayesian";
import { solveBackwardInduction } from "../compute/backward-induction";
import { eliminateDominance } from "../compute/dominance";
import { computeExpectedUtility } from "../compute/expected-utility";
import { solveNash } from "../compute/nash";
import { computeReadiness } from "../compute/readiness";
import type { CanonicalStore } from "../types";
import type {
  BargainingDynamicsResult,
  BaselineEquilibriaResult,
  CommunicationAnalysisResult,
  CommunicationClassificationSummary,
  CrossGameEffectsResult,
  EquilibriumSelectionResult,
  FormalizationAnalysisSummary,
  FormalizationResult,
  OptionValueResult,
  Phase6ProposalGroup,
  Phase6WorkspacePreview,
} from "../types/analysis-pipeline";
import type { EntityRef, SolverReadiness } from "../types/canonical";
import {
  asEntityRef,
  createEntityId,
  createEntityPreview,
  descriptionContains,
} from "./helpers";
import { normalizeCrossGameEffect } from "./cross-game-effects";
import {
  PHASE6_ALL_SUBSECTIONS,
  PHASE6_SUBSECTION_MESSAGES,
} from "./phase-6-subsections";
import type {
  Phase6OverlayResult,
  Phase6RunnerContext,
  Phase6WorkingState,
} from "./phase-6-shared";
import {
  addProposal,
  buildFormalizationProposal,
  emptyStatus,
  firstGame,
  firstTwoPlayers,
  queueStatus,
} from "./phase-6-shared";

function summarizeReadiness(readiness: SolverReadiness): string {
  if (readiness.overall === "ready") {
    return `Ready with ${readiness.supported_solvers.length} supported solver(s).`;
  }
  if (readiness.overall === "usable_with_warnings") {
    return `Usable with warnings: ${readiness.warnings[0] ?? "Review the readiness panel."}`;
  }
  return `Blocked: ${readiness.blockers[0] ?? "Readiness checks failed."}`;
}

export function analyzeFormalizations(
  overlayResult: Phase6OverlayResult,
  state: Phase6WorkingState,
): {
  baseline_equilibria: BaselineEquilibriaResult;
  equilibrium_selection: EquilibriumSelectionResult;
} {
  if (overlayResult.status === "failed" || !overlayResult.store) {
    return {
      baseline_equilibria: {
        status: "partial",
        analyses: [],
        warnings: overlayResult.warnings,
      },
      equilibrium_selection: {
        status: "partial",
        selections: [],
        warnings: overlayResult.warnings,
      },
    };
  }

  if (state.plannedFormalizations.length === 0) {
    return {
      baseline_equilibria: {
        status: "partial",
        analyses: [],
        warnings: [
          "No planned formalizations were available for solver analysis.",
        ],
      },
      equilibrium_selection: {
        status: "partial",
        selections: [],
        warnings: ["No equilibria were available for selection."],
      },
    };
  }

  const overlay = overlayResult.store;
  const analyses: FormalizationAnalysisSummary[] = [];
  const selections: EquilibriumSelectionResult["selections"] = [];

  for (const planned of state.plannedFormalizations) {
    const formalization = overlay.formalizations[planned.id];
    if (!formalization) {
      continue;
    }

    const readiness = computeReadiness(formalization, overlay).readiness;
    const solver_summaries: FormalizationAnalysisSummary["solver_summaries"] = [
      {
        solver: "readiness",
        status:
          readiness.overall === "not_ready"
            ? "failed"
            : readiness.overall === "usable_with_warnings"
              ? "partial"
              : "success",
        summary: summarizeReadiness(readiness),
        warnings: [...readiness.warnings, ...readiness.blockers],
      },
    ];
    let classification: string | null = null;
    let selectedEquilibriumId: string | null = null;
    const alternatives: string[] = [];

    if (formalization.kind === "normal_form") {
      const nash = solveNash(formalization, overlay);
      const dominance = eliminateDominance(formalization, overlay);
      const expectedUtility = computeExpectedUtility(formalization, overlay);
      solver_summaries.push(
        {
          solver: "nash",
          status: nash.status,
          summary:
            nash.status === "failed"
              ? (nash.error ?? "Nash search failed.")
              : `${nash.equilibria.length} Nash equilibrium candidate(s) identified.`,
          equilibrium_count: nash.equilibria.length,
          warnings: nash.warnings,
        },
        {
          solver: "dominance",
          status: dominance.status,
          summary: `${dominance.eliminated_strategies.length} dominated strategy elimination(s) found.`,
          equilibrium_count: dominance.reduced_game.remaining_cells.length,
          warnings: dominance.warnings,
        },
        {
          solver: "expected_utility",
          status: expectedUtility.status,
          summary: `Best responses summarize expected utility under a uniform-opponent heuristic.`,
          warnings: expectedUtility.warnings,
        },
      );
      selectedEquilibriumId = nash.equilibria[0]?.id ?? null;
      for (const equilibrium of nash.equilibria.slice(1)) {
        alternatives.push(equilibrium.id);
      }
      classification =
        nash.equilibria.length > 1
          ? "Multiple equilibrium candidates remain live."
          : nash.equilibria.length === 1
            ? "Single focal equilibrium candidate."
            : "No solver-cleared Nash equilibrium yet.";
    } else if (formalization.kind === "extensive_form") {
      const backwardInduction = solveBackwardInduction(formalization, overlay);
      solver_summaries.push({
        solver: "backward_induction",
        status: backwardInduction.status,
        summary:
          backwardInduction.status === "failed"
            ? (backwardInduction.error ?? "Backward induction failed.")
            : `Backward induction produced a ${backwardInduction.solution_path.length}-step solution path.`,
        equilibrium_count: backwardInduction.solution_path.length > 0 ? 1 : 0,
        warnings: backwardInduction.warnings,
      });
      selectedEquilibriumId = backwardInduction.solution_path[0] ?? null;
      classification =
        backwardInduction.status === "success"
          ? "Sequential solution path identified."
          : "Tree remains blocked on extensive-form completeness.";
    } else if (formalization.kind === "bayesian") {
      const bayesian = computeBayesianUpdate(formalization, overlay);
      solver_summaries.push({
        solver: "bayesian_update",
        status: bayesian.status,
        summary:
          bayesian.status === "failed"
            ? (bayesian.error ?? "Bayesian update failed.")
            : `Posterior beliefs updated across ${bayesian.update_chain.length} observation step(s).`,
        equilibrium_count: bayesian.posterior_beliefs.length,
        warnings: bayesian.warnings,
      });
      classification =
        bayesian.posterior_beliefs.length > 0
          ? "Belief updating materially changes downstream expectations."
          : "Belief updating remains underspecified.";
    } else if (formalization.kind === "signaling") {
      solver_summaries.push({
        solver: "signaling_classification",
        status: formalization.equilibrium_concept ? "success" : "partial",
        summary: formalization.equilibrium_concept
          ? `Current signaling frame looks ${formalization.equilibrium_concept.replace(/_/g, " ")}.`
          : "Signaling frame lacks an explicit equilibrium concept.",
        warnings: readiness.warnings,
      });
      classification = formalization.equilibrium_concept
        ? `${formalization.equilibrium_concept.replace(/_/g, " ")} signaling structure.`
        : "Signal structure present without equilibrium labeling.";
    } else if (formalization.kind === "repeated") {
      solver_summaries.push({
        solver: "readiness",
        status: readiness.overall === "not_ready" ? "partial" : "success",
        summary:
          readiness.overall === "not_ready"
            ? "Repeated-game simulation remains blocked, but continuation incentives are structurally mapped."
            : "Repeated-game continuation incentives are ready for simulation review.",
        warnings: [...readiness.warnings, ...readiness.blockers],
      });
      classification = "Continuation-value frame active.";
    } else if (formalization.kind === "bargaining") {
      solver_summaries.push({
        solver: "bargaining",
        status: "partial",
        summary:
          "Bargaining structure is represented, but the dedicated bargaining solver remains deferred.",
        warnings: [...readiness.warnings, ...readiness.blockers],
      });
      classification = "Alternating-offers bargaining structure captured.";
    }

    analyses.push({
      formalization_id: formalization.id,
      game_id: formalization.game_id,
      kind: formalization.kind as FormalizationAnalysisSummary["kind"],
      readiness,
      solver_summaries,
      classification,
    });

    if (selectedEquilibriumId || alternatives.length > 0) {
      selections.push({
        formalization_id: formalization.id,
        selected_equilibrium_id: selectedEquilibriumId,
        rationale: selectedEquilibriumId
          ? "Selected the first solver-cleared equilibrium candidate as the current focal point."
          : "No focal equilibrium could be selected yet.",
        alternatives,
      });
    }
  }

  return {
    baseline_equilibria: {
      status: analyses.length > 0 ? "complete" : "partial",
      analyses,
      warnings:
        analyses.length > 0
          ? []
          : ["No formalization analysis summaries were produced."],
    },
    equilibrium_selection: {
      status: selections.length > 0 ? "complete" : "partial",
      selections,
      warnings:
        selections.length > 0
          ? []
          : [
              "Multiple equilibria were not solver-cleared, so selection remains advisory only.",
            ],
    },
  };
}

export function buildBargainingDynamics(
  overlayResult: Phase6OverlayResult,
  state: Phase6WorkingState,
): BargainingDynamicsResult | null {
  const bargainingPlan = state.plannedFormalizations.find(
    (planned) => planned.kind === "bargaining",
  );
  const bargainingModel =
    bargainingPlan && overlayResult.store
      ? overlayResult.store.formalizations[bargainingPlan.id]
      : null;
  if (!bargainingPlan && !bargainingModel) {
    queueStatus(
      state,
      emptyStatus(
        "6e",
        "not_applicable",
        "No bargaining-specific frame was selected for this case.",
      ),
    );
    return null;
  }

  if (overlayResult.status === "failed") {
    queueStatus(
      state,
      emptyStatus(
        "6e",
        "partial",
        "Bargaining dynamics were identified, but the speculative overlay could not be built.",
        overlayResult.warnings,
      ),
    );
    return {
      status: "partial",
      applicable: true,
      summary:
        "A bargaining lens is relevant here, but the proposed formalization could not be materialized for deeper review in this pass.",
      leverage_points: [],
      warnings: overlayResult.warnings,
    };
  }

  queueStatus(
    state,
    emptyStatus(
      "6e",
      "complete",
      "Bargaining leverage and outside-option dynamics were summarized.",
    ),
  );
  return {
    status: "complete",
    applicable: true,
    summary:
      "Outside options, delay costs, and first-mover dynamics jointly shape the bargaining envelope.",
    leverage_points: [
      "Outside options anchor reservation values.",
      "Delay costs create pressure against indefinite holdouts.",
      "First-mover control shapes agenda-setting power.",
    ],
    warnings: [],
  };
}

export function buildCommunicationAnalysis(
  context: Phase6RunnerContext,
  state: Phase6WorkingState,
): CommunicationAnalysisResult {
  const game = firstGame(context.canonical);
  const players = firstTwoPlayers(game);
  const description = context.analysisState.event_description;

  if (
    !game ||
    players.length === 0 ||
    !descriptionContains(
      description,
      "signal",
      "credib",
      "audience",
      "statement",
      "message",
    )
  ) {
    queueStatus(
      state,
      emptyStatus(
        "6f",
        "not_applicable",
        "No strong communication-signaling cues were detected.",
      ),
    );
    return {
      status: "not_applicable",
      classifications: [],
      warnings: [],
    };
  }

  const classifications: CommunicationClassificationSummary[] = players.map(
    (playerId, index) => {
      const classification = descriptionContains(description, "audience")
        ? "audience_cost"
        : index === 0
          ? "costly_signal"
          : "cheap_talk";
      const id = createEntityId("signal_classification");
      const proposal = buildFormalizationProposal(context, {
        subsection: "6f",
        description: `Classify ${context.canonical.players[playerId]?.name ?? playerId} communication incentives in ${game.name}.`,
        proposal_type: "signal",
        commands: [
          {
            kind: "add_signal_classification",
            id,
            payload: {
              player_id: playerId,
              signal_description: `${context.canonical.players[playerId]?.name ?? playerId} is sending strategic messages that affect counterpart beliefs.`,
              classification,
              cost_description:
                classification === "costly_signal"
                  ? "Backing down after a hardline signal would impose reputational or material cost."
                  : null,
              informativeness:
                classification === "cheap_talk" ? "medium" : "high",
              informativeness_conditions: [
                "Interpret in the context of current bargaining leverage and audience incentives.",
              ],
              evidence_refs: [],
              game_refs: [asEntityRef("game", game.id)],
            },
          },
        ],
        previews: [
          createEntityPreview("signal_classification", "add", id, {
            player_id: playerId,
            classification,
          }),
        ],
      });
      addProposal(state, "6f", proposal);
      return {
        id,
        player_id: playerId,
        classification,
        summary: `${context.canonical.players[playerId]?.name ?? playerId} is best modeled as ${classification.replace(/_/g, " ")} in the current messaging environment.`,
      };
    },
  );

  queueStatus(
    state,
    emptyStatus(
      "6f",
      "complete",
      `Classified communication incentives for ${classifications.length} player signal channel(s).`,
    ),
  );
  return {
    status: "complete",
    classifications,
    warnings: [],
  };
}

export function buildOptionValue(
  context: Phase6RunnerContext,
  state: Phase6WorkingState,
): OptionValueResult | null {
  const game = firstGame(context.canonical);
  const description = context.analysisState.event_description;
  if (
    !game ||
    !descriptionContains(
      description,
      "wait",
      "delay",
      "hold",
      "pause",
      "option",
    )
  ) {
    queueStatus(
      state,
      emptyStatus(
        "6g",
        "not_applicable",
        "No credible wait-or-hold option dominated the current model.",
      ),
    );
    return null;
  }

  const playerId = game.players[0];
  queueStatus(
    state,
    emptyStatus(
      "6g",
      "complete",
      "Option value from waiting or delaying remains materially relevant.",
    ),
  );
  return {
    status: "complete",
    summary:
      "Preserving a delay option has material value because new information can arrive before irreversible commitment.",
    player_options: playerId
      ? [
          {
            player_id: playerId,
            option: "Delay and gather additional information",
            value: "material",
          },
        ]
      : [],
    warnings: [],
  };
}

export function buildBehavioralOverlay(
  context: Phase6RunnerContext,
  state: Phase6WorkingState,
): FormalizationResult["behavioral_overlays"] {
  const description = context.analysisState.event_description;
  const cues: NonNullable<
    FormalizationResult["behavioral_overlays"]
  >["overlays"] = [];
  if (
    descriptionContains(
      description,
      "election",
      "domestic politics",
      "audience",
    )
  ) {
    cues.push({
      label: "Domestic political pressure",
      effect_on_prediction: "shifts_risk" as const,
      summary:
        "Domestic audience costs may compress the negotiated settlement space.",
    });
  }
  if (
    descriptionContains(
      description,
      "bias",
      "misperception",
      "emotion",
      "prestige",
    )
  ) {
    cues.push({
      label: "Behavioral misperception risk",
      effect_on_prediction: "changes_prediction" as const,
      summary:
        "Behavioral overlays suggest the baseline rational model may underweight escalation traps.",
    });
  }

  if (cues.length === 0) {
    queueStatus(
      state,
      emptyStatus(
        "6h",
        "not_applicable",
        "No strong adjacent behavioral overlay stood out in this pass.",
      ),
    );
    return null;
  }

  if (
    cues.some(
      (overlay) => overlay.effect_on_prediction === "changes_prediction",
    )
  ) {
    const game = firstGame(context.canonical);
    if (game) {
      state.revalidationTriggers.push("behavioral_overlay_changes_prediction");
      state.revalidationEntities.push(asEntityRef("game", game.id));
      state.revalidationNotes.push(
        "Behavioral overlays materially change the predicted branch weights.",
      );
    }
  }

  queueStatus(
    state,
    emptyStatus(
      "6h",
      "complete",
      "Adjacent behavioral overlays were documented without replacing the core game-theoretic model.",
    ),
  );
  return {
    status: "complete",
    label: "ADJACENT — NOT CORE GAME THEORY",
    methodology_flags: [
      "Use only as an adjacent overlay on top of the core game-theoretic structure.",
      "Do not silently promote behavioral overlays into canonical payoffs without explicit review.",
    ],
    overlays: cues,
    warnings: [],
  };
}

export function buildCrossGameEffects(
  context: Phase6RunnerContext,
  state: Phase6WorkingState,
): CrossGameEffectsResult | null {
  const games = Object.values(context.canonical.games);
  if (games.length < 2) {
    queueStatus(
      state,
      emptyStatus(
        "6i",
        "not_applicable",
        "Only one accepted game is active, so cross-game spillovers remain dormant.",
      ),
    );
    return null;
  }

  const [sourceGame, targetGame] = games;
  const effect = normalizeCrossGameEffect({
    source_game_id: sourceGame!.id,
    target_game_id: targetGame!.id,
    trigger_ref: sourceGame!.id,
    effect_type: "commitment_change",
    target_ref: targetGame!.id,
    rationale:
      "Commitments in the source game change bargaining leverage and timing in the target game.",
  });
  const linkId = createEntityId("cross_game_link");
  const proposal = buildFormalizationProposal(context, {
    subsection: "6i",
    description: `Add a cross-game linkage between ${sourceGame!.name} and ${targetGame!.name}.`,
    proposal_type: "cross_game_link",
    commands: [
      {
        kind: "add_cross_game_link",
        id: linkId,
        payload: effect,
      },
      {
        kind: "update_game",
        payload: {
          id: sourceGame!.id,
          coupling_links: [...sourceGame!.coupling_links, linkId],
        },
      },
      {
        kind: "update_game",
        payload: {
          id: targetGame!.id,
          coupling_links: [...targetGame!.coupling_links, linkId],
        },
      },
    ],
    previews: [
      createEntityPreview("cross_game_link", "add", linkId, {
        source_game_id: effect.source_game_id,
        target_game_id: effect.target_game_id,
        effect_type: effect.effect_type,
      }),
    ],
  });
  addProposal(state, "6i", proposal);
  state.revalidationTriggers.push("new_cross_game_link");
  state.revalidationEntities.push(asEntityRef("cross_game_link", linkId));
  state.revalidationNotes.push(
    "Phase 6 added a new cross-game linkage that should be monitored downstream.",
  );

  queueStatus(
    state,
    emptyStatus(
      "6i",
      "complete",
      "Cross-game spillovers were normalized into an explicit linkage proposal.",
    ),
  );
  return {
    status: "complete",
    effects: [
      {
        source_game_id: effect.source_game_id,
        target_game_id: effect.target_game_id,
        effect_type: effect.effect_type,
        summary: effect.rationale,
      },
    ],
    warnings: [],
  };
}

function describeActorLabel(
  canonical: CanonicalStore,
  node: CanonicalStore["nodes"][string],
): string | null {
  if (node.actor.kind === "player") {
    return (
      canonical.players[node.actor.player_id]?.name ?? node.actor.player_id
    );
  }
  return node.actor.kind;
}

export function buildWorkspacePreviews(
  overlayResult: Phase6OverlayResult,
  state: Phase6WorkingState,
): Record<string, Phase6WorkspacePreview> {
  if (overlayResult.status === "failed" || !overlayResult.store) {
    return {};
  }

  const overlay = overlayResult.store;
  const previews: Record<string, Phase6WorkspacePreview> = {};

  for (const planned of state.plannedFormalizations) {
    const formalization = overlay.formalizations[planned.id];
    if (!formalization) {
      continue;
    }

    if (formalization.kind === "normal_form") {
      const playerIds = Object.keys(formalization.strategies);
      const rowPlayerId = playerIds[0] ?? null;
      const colPlayerId = playerIds[1] ?? null;
      previews[formalization.id] = {
        kind: "normal_form",
        formalization_id: formalization.id,
        game_id: formalization.game_id,
        player_ids: playerIds,
        row_player_id: rowPlayerId,
        col_player_id: colPlayerId,
        row_strategies: rowPlayerId
          ? [...(formalization.strategies[rowPlayerId] ?? [])]
          : [],
        col_strategies: colPlayerId
          ? [...(formalization.strategies[colPlayerId] ?? [])]
          : [],
        cells: formalization.payoff_cells.map((cell) => ({
          row_strategy: rowPlayerId
            ? (cell.strategy_profile[rowPlayerId] ?? "")
            : "",
          col_strategy: colPlayerId
            ? (cell.strategy_profile[colPlayerId] ?? "")
            : "",
          payoffs: cell.payoffs,
        })),
      };
      continue;
    }

    if (formalization.kind === "extensive_form") {
      const nodes = Object.values(overlay.nodes)
        .filter((node) => node.formalization_id === formalization.id)
        .map((node) => ({
          id: node.id,
          type: node.type,
          label: node.label,
          actor_label: describeActorLabel(overlay, node),
          terminal_payoffs: node.terminal_payoffs,
        }));
      const edges = Object.values(overlay.edges)
        .filter((edge) => edge.formalization_id === formalization.id)
        .map((edge) => ({
          id: edge.id,
          from: edge.from,
          to: edge.to,
          label: edge.label,
        }));
      previews[formalization.id] = {
        kind: "extensive_form",
        formalization_id: formalization.id,
        game_id: formalization.game_id,
        root_node_id: formalization.root_node_id,
        nodes,
        edges,
      };
    }
  }

  return previews;
}

export function buildProposalGroups(
  state: Phase6WorkingState,
): Phase6ProposalGroup[] {
  return PHASE6_ALL_SUBSECTIONS.flatMap((subsection) =>
    state.proposalsBySubsection[subsection].length > 0
      ? [
          {
            subsection,
            content: PHASE6_SUBSECTION_MESSAGES[subsection],
            proposals: state.proposalsBySubsection[subsection],
          },
        ]
      : [],
  );
}

export function dedupeEntityRefs(refs: EntityRef[]): EntityRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.type}:${ref.id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
