import type {
  FormalRepresentationResult,
  FormalizationRepresentationSummary,
  PayoffEstimationResult,
} from "../types/analysis-pipeline";
import {
  asEntityRef,
  createEntityId,
  createEntityPreview,
  descriptionContains,
} from "./helpers";
import type {
  Phase6FormalizationPayload,
  Phase6RunnerContext,
  Phase6WorkingState,
  PlannedFormalization,
} from "./phase-6-shared";
import {
  addProposal,
  appendPlannedFormalization,
  buildAssumptionCommand,
  buildFormalizationProposal,
  buildFormalizationSummary,
  createStructuredEstimate,
  emptyStatus,
  firstGame,
  firstTwoPlayers,
  getHistoricalResult,
  queueStatus,
  SUPPORTED_PHASE6_FORMALIZATION_KINDS,
} from "./phase-6-shared";
import {
  buildBargainingPayload,
  buildBayesianPayload,
  buildExtensiveFormCommands,
  buildNormalFormPayload,
  buildNormalFormPayoffCellsForExisting,
  buildRepeatedPayload,
  buildSignalingPayload,
  extractExtensiveNodeIds,
} from "./phase-6-formalization-builders";

export function seedAcceptedFormalizations(
  context: Phase6RunnerContext,
  state: Phase6WorkingState,
): void {
  if (state.plannedFormalizations.length > 0) {
    return;
  }

  const game = firstGame(context.canonical);
  if (!game) {
    return;
  }

  for (const formalizationId of game.formalizations) {
    const formalization = context.canonical.formalizations[formalizationId];
    if (!formalization) {
      continue;
    }
    if (
      !SUPPORTED_PHASE6_FORMALIZATION_KINDS.has(
        formalization.kind as FormalizationRepresentationSummary["kind"],
      )
    ) {
      continue;
    }

    appendPlannedFormalization(state, {
      id: formalization.id,
      gameId: game.id,
      gameName: game.name,
      kind: formalization.kind as PlannedFormalization["kind"],
      purpose: formalization.purpose,
      abstraction_level: formalization.abstraction_level,
      reused_existing: true,
      rationale:
        "Use the accepted formalization as the basis for this Phase 6 subsection run.",
      assumption_ids: [...formalization.assumptions],
      node_ids:
        formalization.kind === "extensive_form"
          ? extractExtensiveNodeIds(context.canonical, formalization.id)
          : undefined,
    });
  }
}

export function planFormalRepresentations(
  context: Phase6RunnerContext,
  state: Phase6WorkingState,
): FormalRepresentationResult {
  const game = firstGame(context.canonical);
  const players = firstTwoPlayers(game);
  if (!game || players.length < 2) {
    queueStatus(
      state,
      emptyStatus(
        "6a",
        "not_applicable",
        "No accepted baseline game with two players is available for formalization.",
      ),
    );
    return {
      status: "not_applicable",
      summaries: [],
      reused_formalization_ids: [],
      new_game_hypotheses: [],
      assumption_proposal_ids: [],
      warnings: [
        "Phase 6 needs an accepted game and two players before formalization can proceed.",
      ],
    };
  }

  const historical = getHistoricalResult(context);
  const description = context.analysisState.event_description;
  const gameFormalizations = game.formalizations
    .map((id) => context.canonical.formalizations[id])
    .filter(Boolean);
  const summaries: FormalizationRepresentationSummary[] = [];
  const reusedIds: string[] = [];
  const assumptionProposalIds: string[] = [];
  const newGameHypotheses: FormalRepresentationResult["new_game_hypotheses"] =
    [];

  const baselineExisting = gameFormalizations.find(
    (formalization) =>
      formalization.kind === "normal_form" ||
      formalization.kind === "extensive_form",
  );
  if (baselineExisting) {
    reusedIds.push(baselineExisting.id);
    appendPlannedFormalization(state, {
      id: baselineExisting.id,
      gameId: game.id,
      gameName: game.name,
      kind: baselineExisting.kind as PlannedFormalization["kind"],
      purpose: baselineExisting.purpose,
      abstraction_level: baselineExisting.abstraction_level,
      reused_existing: true,
      rationale:
        "Phase 3 baseline formalization already covers the core strategic spine.",
      assumption_ids: [...baselineExisting.assumptions],
      node_ids:
        baselineExisting.kind === "extensive_form"
          ? extractExtensiveNodeIds(context.canonical, baselineExisting.id)
          : undefined,
    });
    summaries.push(
      buildFormalizationSummary(
        baselineExisting,
        context.canonical,
        true,
        "Phase 3 baseline formalization already covers the core strategic spine.",
      ),
    );
  } else {
    const formalizationId = createEntityId("formalization");
    const assumptionId = createEntityId("assumption");
    const wantsExtensive =
      game.move_order === "sequential" ||
      descriptionContains(description, "deadline", "ultimatum", "sequence");
    const baseCommands = [
      buildAssumptionCommand(
        assumptionId,
        "Players preserve the same baseline action menu during the current decision window.",
        "structural",
      ),
    ];

    let previews = [
      createEntityPreview("assumption", "add", assumptionId, {
        statement:
          "Players preserve the same baseline action menu during the current decision window.",
      }),
    ];

    let planned: PlannedFormalization;
    if (wantsExtensive) {
      const extensive = buildExtensiveFormCommands(
        formalizationId,
        game.id,
        players[0]!,
      );
      baseCommands.push(
        {
          kind: "add_formalization",
          id: formalizationId,
          payload: {
            ...extensive.payload,
            assumptions: [assumptionId],
          },
        },
        {
          kind: "attach_formalization_to_game",
          payload: {
            game_id: game.id,
            formalization_id: formalizationId,
          },
        },
        ...extensive.commands,
      );
      previews = [
        ...previews,
        createEntityPreview("formalization", "add", formalizationId, {
          kind: "extensive_form",
          game_id: game.id,
        }),
      ];
      planned = {
        id: formalizationId,
        gameId: game.id,
        gameName: game.name,
        kind: "extensive_form",
        purpose: "computational",
        abstraction_level: "moderate",
        reused_existing: false,
        rationale:
          "Sequential timing and deadline cues justify an extensive-form baseline.",
        assumption_ids: [assumptionId],
        node_ids: extensive.nodeIds,
      };
    } else {
      baseCommands.push(
        {
          kind: "add_formalization",
          id: formalizationId,
          payload: {
            ...buildNormalFormPayload(formalizationId, game.id, players),
            assumptions: [assumptionId],
          },
        },
        {
          kind: "attach_formalization_to_game",
          payload: {
            game_id: game.id,
            formalization_id: formalizationId,
          },
        },
      );
      previews = [
        ...previews,
        createEntityPreview("formalization", "add", formalizationId, {
          kind: "normal_form",
          game_id: game.id,
        }),
      ];
      planned = {
        id: formalizationId,
        gameId: game.id,
        gameName: game.name,
        kind: "normal_form",
        purpose: "computational",
        abstraction_level: "moderate",
        reused_existing: false,
        rationale:
          "A compact matrix remains the best computational anchor for the current baseline.",
        assumption_ids: [assumptionId],
      };
    }

    const proposal = buildFormalizationProposal(context, {
      subsection: "6a",
      description: `Create a ${planned.kind.replace(/_/g, " ")} baseline formalization for ${game.name}.`,
      proposal_type: "formalization",
      commands: baseCommands,
      previews,
    });
    addProposal(state, "6a", proposal);
    assumptionProposalIds.push(proposal.id);
    appendPlannedFormalization(state, planned);
    summaries.push({
      formalization_id: planned.id,
      game_id: planned.gameId,
      game_name: planned.gameName,
      kind: planned.kind,
      purpose: planned.purpose,
      abstraction_level: planned.abstraction_level,
      reused_existing: false,
      rationale: planned.rationale,
      assumption_ids: planned.assumption_ids,
    });
  }

  const anchor = state.plannedFormalizations[0];
  if (!anchor) {
    queueStatus(
      state,
      emptyStatus(
        "6a",
        "partial",
        "No Phase 6 formalization anchor could be established.",
      ),
    );
    return {
      status: "partial",
      summaries,
      reused_formalization_ids: reusedIds,
      new_game_hypotheses: newGameHypotheses,
      assumption_proposal_ids: assumptionProposalIds,
      warnings: [
        "Phase 6 could not establish a computational anchor formalization.",
      ],
    };
  }

  const needsRepeated =
    Boolean(historical?.patterns_found.length) ||
    descriptionContains(
      description,
      "repeat",
      "iterat",
      "relationship",
      "history",
    );
  const needsBayesian =
    Boolean(historical?.baseline_recheck.hidden_type_uncertainty) ||
    descriptionContains(
      description,
      "uncertain",
      "private",
      "hidden type",
      "screen",
    );
  const needsSignaling =
    Boolean(historical?.global_signaling_effects.length) ||
    descriptionContains(description, "signal", "credib", "audience");
  const needsBargaining =
    game.canonical_game_type === "bargaining" ||
    game.semantic_labels.includes("bargaining") ||
    descriptionContains(description, "bargain", "negotiat", "settlement");

  function maybeAddComplementaryFormalization(params: {
    enabled: boolean;
    kind: PlannedFormalization["kind"];
    rationale: string;
    payload: Phase6FormalizationPayload;
  }) {
    if (!params.enabled) {
      return;
    }
    const existing = gameFormalizations.find(
      (formalization) => formalization.kind === params.kind,
    );
    if (existing) {
      reusedIds.push(existing.id);
      appendPlannedFormalization(state, {
        id: existing.id,
        gameId: game.id,
        gameName: game.name,
        kind: params.kind,
        purpose: existing.purpose,
        abstraction_level: existing.abstraction_level,
        reused_existing: true,
        rationale: params.rationale,
        assumption_ids: [...existing.assumptions],
        node_ids:
          existing.kind === "extensive_form"
            ? extractExtensiveNodeIds(context.canonical, existing.id)
            : undefined,
      });
      summaries.push(
        buildFormalizationSummary(
          existing,
          context.canonical,
          true,
          params.rationale,
        ),
      );
      return;
    }

    const formalizationId = createEntityId("formalization");
    const assumptionId = createEntityId("assumption");
    const proposal = buildFormalizationProposal(context, {
      subsection: "6a",
      description: `Add a complementary ${params.kind.replace(/_/g, " ")} formalization for ${game.name}.`,
      proposal_type: "formalization",
      commands: [
        buildAssumptionCommand(
          assumptionId,
          `${params.kind.replace(/_/g, " ")} framing captures a strategically distinct lens for ${game.name}.`,
          params.kind === "bayesian" || params.kind === "signaling"
            ? "information"
            : "structural",
        ),
        {
          kind: "add_formalization",
          id: formalizationId,
          payload: {
            ...params.payload,
            assumptions: [assumptionId],
            game_id: game.id,
          },
        },
        {
          kind: "attach_formalization_to_game",
          payload: {
            game_id: game.id,
            formalization_id: formalizationId,
          },
        },
      ],
      previews: [
        createEntityPreview("assumption", "add", assumptionId, {
          statement: `${params.kind.replace(/_/g, " ")} framing captures a strategically distinct lens for ${game.name}.`,
        }),
        createEntityPreview("formalization", "add", formalizationId, {
          kind: params.kind,
          game_id: game.id,
        }),
      ],
    });
    addProposal(state, "6a", proposal);
    assumptionProposalIds.push(proposal.id);
    appendPlannedFormalization(state, {
      id: formalizationId,
      gameId: game.id,
      gameName: game.name,
      kind: params.kind,
      purpose: params.payload.purpose,
      abstraction_level: params.payload.abstraction_level,
      reused_existing: false,
      rationale: params.rationale,
      assumption_ids: [assumptionId],
    });
    summaries.push({
      formalization_id: formalizationId,
      game_id: game.id,
      game_name: game.name,
      kind: params.kind,
      purpose: params.payload.purpose,
      abstraction_level: params.payload.abstraction_level,
      reused_existing: false,
      rationale: params.rationale,
      assumption_ids: [assumptionId],
    });
  }

  maybeAddComplementaryFormalization({
    enabled: needsRepeated,
    kind: "repeated",
    rationale:
      "Historical interaction appears persistent enough to warrant an indefinite repeated-game lens.",
    payload: buildRepeatedPayload(game.id, anchor.id, players),
  });
  maybeAddComplementaryFormalization({
    enabled: needsBayesian,
    kind: "bayesian",
    rationale:
      "Hidden type or private-information cues justify an incomplete-information overlay.",
    payload: buildBayesianPayload(game.id, players),
  });
  maybeAddComplementaryFormalization({
    enabled: needsSignaling,
    kind: "signaling",
    rationale:
      "Communication and credibility cues justify an explicit signaling frame.",
    payload: buildSignalingPayload(game.id),
  });
  maybeAddComplementaryFormalization({
    enabled: needsBargaining,
    kind: "bargaining",
    rationale:
      "The case is negotiation-shaped enough to warrant a bargaining lens alongside the baseline anchor.",
    payload: buildBargainingPayload(game.id, players),
  });

  const introducedReframing = state.plannedFormalizations.some(
    (planned) =>
      !planned.reused_existing &&
      planned.gameId === game.id &&
      (planned.kind === "repeated" ||
        planned.kind === "bayesian" ||
        planned.kind === "signaling"),
  );

  if (newGameHypotheses.length > 0) {
    state.revalidationTriggers.push("new_game_identified");
    state.revalidationEntities.push(asEntityRef("game", game.id));
    state.revalidationNotes.push(
      "Phase 6 surfaced a new game hypothesis that changes the analysis frame.",
    );
  } else if (introducedReframing) {
    state.revalidationTriggers.push("game_reframed");
    state.revalidationEntities.push(asEntityRef("game", game.id));
    state.revalidationNotes.push(
      "Phase 6 introduced a structurally distinct strategic framing beyond the original baseline.",
    );
  }

  queueStatus(
    state,
    emptyStatus(
      "6a",
      "complete",
      `Prepared ${summaries.length} formal representation${summaries.length === 1 ? "" : "s"} for Phase 6.`,
    ),
  );

  return {
    status: "complete",
    summaries,
    reused_formalization_ids: reusedIds,
    new_game_hypotheses: newGameHypotheses,
    assumption_proposal_ids: assumptionProposalIds,
    warnings: [],
  };
}

export function planPayoffEstimation(
  context: Phase6RunnerContext,
  state: Phase6WorkingState,
): PayoffEstimationResult {
  if (state.plannedFormalizations.length === 0) {
    queueStatus(
      state,
      emptyStatus(
        "6b",
        "partial",
        "No planned formalizations exist yet for payoff estimation.",
      ),
    );
    return {
      status: "partial",
      updates: [],
      warnings: [
        "Run 6a or provide an accepted formalization before estimating payoffs.",
      ],
    };
  }

  const updates: PayoffEstimationResult["updates"] = [];

  for (const planned of state.plannedFormalizations) {
    if (planned.kind === "normal_form") {
      const existingFormalization =
        context.canonical.formalizations[planned.id];
      const payoffCells =
        existingFormalization && existingFormalization.kind === "normal_form"
          ? buildNormalFormPayoffCellsForExisting(existingFormalization)
          : buildNormalFormPayload(
              planned.id,
              planned.gameId,
              firstTwoPlayers(context.canonical.games[planned.gameId]) || [],
            ).payoff_cells;
      const proposal = buildFormalizationProposal(context, {
        subsection: "6b",
        description: `Populate solver-facing payoff estimates for ${planned.gameName}.`,
        proposal_type: "formalization",
        commands: [
          {
            kind: "update_formalization",
            payload: {
              id: planned.id,
              payoff_cells: payoffCells,
            },
          },
        ],
        previews: [
          createEntityPreview("formalization", "update", planned.id, {
            kind: planned.kind,
            payoff_style: "interval_estimate",
          }),
        ],
      });
      addProposal(state, "6b", proposal);
      updates.push({
        formalization_id: planned.id,
        ordinal_first: true,
        updated_profiles: payoffCells.length,
        updated_terminal_nodes: 0,
        cardinal_justifications: [
          "Cardinal interval bands were added because Phase 6 solver summaries require comparable payoff magnitudes.",
        ],
      });
      continue;
    }

    if (planned.kind === "extensive_form" && planned.node_ids) {
      const players = firstTwoPlayers(context.canonical.games[planned.gameId]);
      const proposal = buildFormalizationProposal(context, {
        subsection: "6b",
        description: `Populate terminal utility estimates for the extensive-form branch structure in ${planned.gameName}.`,
        proposal_type: "formalization",
        commands: [
          {
            kind: "update_game_node",
            payload: {
              id: planned.node_ids.accept,
              terminal_payoffs: {
                [players[0]!]: createStructuredEstimate({
                  representation: "interval_estimate",
                  min: 4,
                  max: 6,
                  rationale:
                    "Accommodation branch preserves leverage at moderate cost.",
                }),
                [players[1]!]: createStructuredEstimate({
                  representation: "interval_estimate",
                  min: 2,
                  max: 4,
                  rationale:
                    "Accommodation branch preserves the counterparty position but concedes some initiative.",
                }),
              },
            },
          },
          {
            kind: "update_game_node",
            payload: {
              id: planned.node_ids.resist,
              terminal_payoffs: {
                [players[0]!]: createStructuredEstimate({
                  representation: "interval_estimate",
                  min: 1,
                  max: 3,
                  rationale:
                    "Delay branch preserves flexibility but risks drift.",
                }),
                [players[1]!]: createStructuredEstimate({
                  representation: "interval_estimate",
                  min: 3,
                  max: 5,
                  rationale:
                    "Delay branch protects the counterparty from immediate concession.",
                }),
              },
            },
          },
        ],
        previews: [
          createEntityPreview("game_node", "update", planned.node_ids.accept, {
            label: "Accommodation outcome",
            payoffs: "updated",
          }),
          createEntityPreview("game_node", "update", planned.node_ids.resist, {
            label: "Resistance outcome",
            payoffs: "updated",
          }),
        ],
      });
      addProposal(state, "6b", proposal);
      updates.push({
        formalization_id: planned.id,
        ordinal_first: true,
        updated_profiles: 0,
        updated_terminal_nodes: 2,
        cardinal_justifications: [
          "Terminal utility intervals were added to support backward induction on the branch structure.",
        ],
      });
    }
  }

  queueStatus(
    state,
    emptyStatus(
      "6b",
      updates.length > 0 ? "complete" : "partial",
      updates.length > 0
        ? `Estimated payoffs for ${updates.length} formalization${updates.length === 1 ? "" : "s"}.`
        : "No solver-facing payoff updates were generated.",
    ),
  );

  return {
    status: updates.length > 0 ? "complete" : "partial",
    updates,
    warnings:
      updates.length > 0
        ? []
        : ["No formalization required Phase 6 payoff updates."],
  };
}
