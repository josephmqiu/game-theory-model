import type { CanonicalStore } from "../types";
import type { NormalFormModel } from "../types/formalizations";
import type {
  AnalysisState,
  BaselineModelResult,
  HistoricalGameResult,
  ModelProposal,
  PhaseExecution,
  PhaseResult,
  ProposedBaselineGame,
  ProposedCrossGameConstraintTable,
  ProposedDynamicInconsistencyRisk,
  ProposedEscalationLadder,
  ProposedRepeatedGamePattern,
  ProposedStrategyTable,
  ProposedTrustAssessment,
  RepeatedGameMapEntry,
} from "../types/analysis-pipeline";
import {
  asEntityRef,
  buildModelProposal,
  createConfidenceEstimate,
  createEntityId,
  createEntityPreview,
  createEstimate,
  descriptionContains,
} from "./helpers";

export interface Phase34RunnerContext {
  canonical: CanonicalStore;
  analysisState: AnalysisState;
  baseRevision: number;
  phaseExecution: PhaseExecution;
}

function inferCanonicalGameType(
  description: string,
): ProposedBaselineGame["canonical_type"] {
  if (
    descriptionContains(
      description,
      "sanction",
      "threat",
      "brink",
      "strike",
      "escalat",
    )
  )
    return "chicken_brinkmanship";
  if (descriptionContains(description, "entry", "incumbent", "market"))
    return "entry_deterrence";
  if (descriptionContains(description, "price", "collusion", "firm"))
    return "prisoners_dilemma";
  if (descriptionContains(description, "signal", "credib", "audience"))
    return "signaling";
  return "bargaining";
}

function buildStrategyTable(
  playerIds: string[],
  description: string,
): ProposedStrategyTable {
  const baseStrategies = descriptionContains(description, "market", "entry")
    ? [
        ["Enter aggressively", "Pilot launch"],
        ["Cut price", "Accommodate"],
      ]
    : [
        ["Escalate", "Hold"],
        ["Concede", "Resist"],
      ];

  return {
    players: playerIds,
    strategies: playerIds.map((playerId, index) => ({
      player_id: playerId,
      strategies: (baseStrategies[index] ?? ["Advance", "Delay"]).map(
        (label) => ({
          label,
          feasibility: "feasible",
          requirements: ["Leadership alignment", "Resource commitment"],
          evidence_refs: [],
        }),
      ),
    })),
    outcome_cells: null,
  };
}

function buildBaselineGame(
  context: Phase34RunnerContext,
): ProposedBaselineGame {
  const players = Object.keys(context.canonical.players).slice(0, 2);
  const canonical_type = inferCanonicalGameType(
    context.analysisState.event_description,
  );
  return {
    temp_id: createEntityId("game"),
    name: `${canonical_type.replace(/_/g, " ")} baseline`,
    canonical_type,
    players,
    description: `Minimal baseline model for ${context.analysisState.event_description}.`,
    move_order: descriptionContains(
      context.analysisState.event_description,
      "sequence",
      "deadline",
      "ultimatum",
    )
      ? "sequential"
      : "simultaneous",
    time_structure: {
      event_time: "Current crisis window",
      model_time: "One baseline strategic move per side",
      simulation_time: "Turn-based from current posture",
    },
    deterrence_vs_compellence: descriptionContains(
      context.analysisState.event_description,
      "force",
      "threat",
      "deterr",
    )
      ? "deterrence"
      : descriptionContains(
            context.analysisState.event_description,
            "compel",
            "pressure",
          )
        ? "compellence"
        : "both",
    institutional_constraints: [
      {
        category: "regulatory",
        description:
          "Existing institutional constraints limit how quickly actors can change course.",
        constraining_effect:
          "Raises switching costs and slows strategic pivots.",
        evidence_refs: [],
      },
    ],
    adjacent_game_test: "uncertain",
    evidence_refs: [],
    confidence: createConfidenceEstimate(
      "Baseline game fit from Phase 1 and Phase 2 structure.",
      [],
      0.72,
    ),
    rationale:
      "Chosen as the smallest canonical game that captures the main strategic tension.",
  };
}

function buildEscalationRungs(): ProposedEscalationLadder["rungs"] {
  return [
    {
      label: "Symbolic move",
      description: "Low-cost signaling move.",
      reversible: true,
      climbed: true,
      player_attribution: null,
      evidence_refs: [],
      strategic_implications: "Tests resolve without full commitment.",
    },
    {
      label: "Material pressure",
      description: "Concrete coercive or market move.",
      reversible: false,
      climbed: false,
      player_attribution: null,
      evidence_refs: [],
      strategic_implications: "Raises cost of backing down.",
    },
  ];
}

function buildCrossGameConstraintTable(
  baselineGame: ProposedBaselineGame,
  strategyTable: ProposedStrategyTable,
): ProposedCrossGameConstraintTable {
  return {
    strategies: strategyTable.strategies.flatMap((entry) =>
      entry.strategies.map((strategy) => ({
        player_id: entry.player_id,
        strategy_label: strategy.label,
      })),
    ),
    games: [asEntityRef("game", baselineGame.temp_id)],
    cells: [],
    trapped_players: baselineGame.players.map((playerId) =>
      asEntityRef("player", playerId),
    ),
  };
}

function buildBaselineProposals(
  baselineGame: ProposedBaselineGame,
  strategyTable: ProposedStrategyTable,
  context: Phase34RunnerContext,
): ModelProposal[] {
  const formalizationId = createEntityId("formalization");
  const payoff_cells =
    strategyTable.strategies[0]?.strategies.flatMap((rowStrategy) =>
      (strategyTable.strategies[1]?.strategies ?? []).map((colStrategy) => ({
        strategy_profile: {
          [strategyTable.players[0]!]: rowStrategy.label,
          [strategyTable.players[1]!]: colStrategy.label,
        },
        payoffs: {},
      })),
    ) ?? [];

  const baselineProposal = buildModelProposal({
    description: `Create baseline game ${baselineGame.name}`,
    phase: 3,
    proposal_type: "game",
    phaseExecution: context.phaseExecution,
    baseRevision: context.baseRevision,
    commands: [
      {
        kind: "add_game",
        id: baselineGame.temp_id,
        payload: {
          name: baselineGame.name,
          description: baselineGame.description,
          semantic_labels: [
            baselineGame.canonical_type === "chicken_brinkmanship"
              ? "chicken"
              : "bargaining",
          ],
          players: baselineGame.players,
          status: "active",
          formalizations: [formalizationId],
          coupling_links: [],
          key_assumptions: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          canonical_game_type: baselineGame.canonical_type,
          move_order: baselineGame.move_order,
          time_structure: baselineGame.time_structure,
          deterrence_vs_compellence: baselineGame.deterrence_vs_compellence,
          institutional_constraints: baselineGame.institutional_constraints,
          model_gaps: ["Hidden reservation values remain uncertain."],
          adjacent_game_test: baselineGame.adjacent_game_test,
        },
      },
      {
        kind: "add_formalization",
        id: formalizationId,
        payload: {
          game_id: baselineGame.temp_id,
          kind: "normal_form",
          purpose: "explanatory",
          abstraction_level: "minimal",
          assumptions: [],
          strategies: Object.fromEntries(
            strategyTable.strategies.map((entry) => [
              entry.player_id,
              entry.strategies.map((strategy) => strategy.label),
            ]),
          ),
          payoff_cells,
        } as Omit<NormalFormModel, "id">,
      },
      {
        kind: "attach_formalization_to_game",
        payload: {
          game_id: baselineGame.temp_id,
          formalization_id: formalizationId,
        },
      },
    ],
    entity_previews: [
      createEntityPreview("game", "add", baselineGame.temp_id, {
        name: baselineGame.name,
        canonical_game_type: baselineGame.canonical_type,
        players: baselineGame.players,
      }),
      createEntityPreview("formalization", "add", formalizationId, {
        kind: "normal_form",
        game_id: baselineGame.temp_id,
      }),
    ],
  });

  const escalationProposals = descriptionContains(
    context.analysisState.event_description,
    "sanction",
    "strike",
    "escalat",
    "deterr",
  )
    ? (() => {
        const escalationId = createEntityId("escalation_ladder");
        const rungs = buildEscalationRungs();
        return [
          buildModelProposal({
            description: "Add escalation ladder for the baseline game",
            phase: 3,
            proposal_type: "escalation",
            phaseExecution: context.phaseExecution,
            baseRevision: context.baseRevision,
            commands: [
              {
                kind: "add_escalation_ladder",
                id: escalationId,
                payload: {
                  game_id: baselineGame.temp_id,
                  rungs: rungs.map((rung) => ({
                    ...rung,
                    id: createEntityId("rung"),
                    player_attribution: null,
                  })),
                  current_rung_index: 0,
                  escalation_dominance: null,
                  stability_instability_paradox: true,
                },
              },
            ],
            entity_previews: [
              createEntityPreview("escalation_ladder", "add", escalationId, {
                game_id: baselineGame.temp_id,
                rungs: rungs.length,
              }),
            ],
          }),
        ];
      })()
    : [];

  const crossGameConstraintProposals =
    Object.keys(context.canonical.players).length > 2
      ? (() => {
          const tableId = createEntityId("cross_game_constraint_table");
          const constraintTable = buildCrossGameConstraintTable(
            baselineGame,
            strategyTable,
          );
          return [
            buildModelProposal({
              description:
                "Add cross-game constraint table for overlapping strategic commitments",
              phase: 3,
              proposal_type: "constraint_table",
              phaseExecution: context.phaseExecution,
              baseRevision: context.baseRevision,
              commands: [
                {
                  kind: "add_cross_game_constraint_table",
                  id: tableId,
                  payload: constraintTable,
                },
              ],
              entity_previews: [
                createEntityPreview(
                  "cross_game_constraint_table",
                  "add",
                  tableId,
                  {
                    strategies: constraintTable.strategies.length,
                    games: constraintTable.games.length,
                  },
                ),
              ],
            }),
          ];
        })()
      : [];

  return [
    baselineProposal,
    ...escalationProposals,
    ...crossGameConstraintProposals,
  ];
}

export function runPhase3Baseline(
  context: Phase34RunnerContext,
): BaselineModelResult {
  const playerIds = Object.keys(context.canonical.players);
  if (playerIds.length < 2) {
    return {
      phase: 3,
      status: {
        status: "failed",
        phase: 3,
        execution_id: context.phaseExecution.id,
        retriable: true,
        error: "Phase 3 requires at least two accepted players from Phase 2.",
      },
      proposed_games: [],
      escalation_ladder: null,
      strategy_table: {
        players: [],
        strategies: [],
        outcome_cells: null,
      },
      cross_game_constraint_table: null,
      model_gaps: [
        "Need accepted player proposals before creating a baseline game.",
      ],
      proposals: [],
    };
  }

  const baselineGame = buildBaselineGame(context);
  const strategyTable = buildStrategyTable(
    baselineGame.players,
    context.analysisState.event_description,
  );
  const proposals = buildBaselineProposals(
    baselineGame,
    strategyTable,
    context,
  );

  const ladderProposal = proposals.find(
    (proposal) => proposal.proposal_type === "escalation",
  );
  const tableProposal = proposals.find(
    (proposal) => proposal.proposal_type === "constraint_table",
  );

  return {
    phase: 3,
    status: {
      status: "complete",
      phase: 3,
      execution_id: context.phaseExecution.id,
      retriable: true,
    } satisfies PhaseResult,
    proposed_games: [baselineGame],
    escalation_ladder: ladderProposal
      ? ({
          game_id: baselineGame.temp_id,
          rungs: buildEscalationRungs(),
          escalation_dominance: null,
          stability_instability_paradox: true,
        } satisfies ProposedEscalationLadder)
      : null,
    strategy_table: strategyTable,
    cross_game_constraint_table: tableProposal
      ? buildCrossGameConstraintTable(baselineGame, strategyTable)
      : null,
    model_gaps: [
      "The baseline model does not yet explain hidden reservation values.",
      "Cross-game spillovers remain approximate until Phase 6 formalization.",
    ],
    proposals,
  };
}

function shiftDate(
  anchor: string | null,
  yearsAgo: number,
  monthOffset: number,
  dayOfMonth: number,
): string {
  const date = new Date(anchor ?? new Date().toISOString());
  date.setUTCFullYear(date.getUTCFullYear() - yearsAgo);
  date.setUTCMonth(
    Math.max(0, Math.min(11, date.getUTCMonth() + monthOffset)),
    dayOfMonth,
  );
  return date.toISOString().slice(0, 10);
}

function buildRepeatedGameMap(
  playerIds: string[],
  anchor: string | null,
): RepeatedGameMapEntry[] {
  return [
    {
      date: shiftDate(anchor, 5, -2, 15),
      description:
        "Initial cooperation signal followed by delayed implementation.",
      move_type: "cooperation",
      player_id: playerIds[0] ?? "unknown_player",
      other_side_state: "Testing intentions",
      outcome: "Partial de-escalation",
      changed_beliefs_or_rules: true,
      evidence_refs: [],
    },
    {
      date: shiftDate(anchor, 3, 1, 4),
      description: "Punitive move after perceived defection.",
      move_type: "punishment",
      player_id: playerIds[1] ?? playerIds[0] ?? "unknown_player",
      other_side_state: "Raised suspicion",
      outcome: "Trust deterioration",
      changed_beliefs_or_rules: true,
      evidence_refs: [],
    },
    {
      date: shiftDate(anchor, 1, -1, 19),
      description: "Short-term concession under deadline pressure.",
      move_type: "concession",
      player_id: playerIds[0] ?? "unknown_player",
      other_side_state: "Seeking stabilization",
      outcome: "Temporary pause",
      changed_beliefs_or_rules: false,
      evidence_refs: [],
    },
  ];
}

function buildPhase4Proposals(params: {
  context: Phase34RunnerContext;
  gameId: string;
  patterns: ProposedRepeatedGamePattern[];
  trustAssessment: ProposedTrustAssessment[];
  dynamicInconsistencyRisks: ProposedDynamicInconsistencyRisk[];
}): ModelProposal[] {
  const {
    context,
    dynamicInconsistencyRisks,
    gameId: _gameId,
    patterns,
    trustAssessment,
  } = params;

  return [
    buildModelProposal({
      description: "Add repeated-game pattern",
      phase: 4,
      proposal_type: "pattern",
      phaseExecution: context.phaseExecution,
      baseRevision: context.baseRevision,
      commands: [
        {
          kind: "add_repeated_game_pattern",
          id: createEntityId("repeated_game_pattern"),
          payload: {
            game_id: patterns[0]!.game_id,
            pattern_type: patterns[0]!.pattern_type,
            description: patterns[0]!.description,
            instances: patterns[0]!.instances,
            impact_on_trust: patterns[0]!.impact_on_trust,
            impact_on_model: patterns[0]!.impact_on_model,
          },
        },
      ],
      entity_previews: [
        createEntityPreview("repeated_game_pattern", "add", null, {
          pattern_type: patterns[0]!.pattern_type,
          game_id: patterns[0]!.game_id,
        }),
      ],
    }),
    buildModelProposal({
      description: "Add trust assessment",
      phase: 4,
      proposal_type: "trust",
      phaseExecution: context.phaseExecution,
      baseRevision: context.baseRevision,
      commands: [
        {
          kind: "add_trust_assessment",
          id: createEntityId("trust_assessment"),
          payload: {
            assessor_player_id: trustAssessment[0]!.assessor_player_id,
            target_player_id: trustAssessment[0]!.target_player_id,
            level: trustAssessment[0]!.level,
            posterior_belief: trustAssessment[0]!.posterior_belief,
            evidence_refs: [],
            interaction_history_summary:
              trustAssessment[0]!.interaction_history_summary,
            driving_patterns: [],
            implications: trustAssessment[0]!.implications,
          },
        },
      ],
      entity_previews: [
        createEntityPreview("trust_assessment", "add", null, {
          assessor_player_id: trustAssessment[0]!.assessor_player_id,
          target_player_id: trustAssessment[0]!.target_player_id,
          level: trustAssessment[0]!.level,
        }),
      ],
    }),
    buildModelProposal({
      description: "Add dynamic inconsistency risk",
      phase: 4,
      proposal_type: "dynamic_risk",
      phaseExecution: context.phaseExecution,
      baseRevision: context.baseRevision,
      commands: [
        {
          kind: "add_dynamic_inconsistency_risk",
          id: createEntityId("dynamic_inconsistency_risk"),
          payload: {
            player_id: dynamicInconsistencyRisks[0]!.player_id,
            commitment_description:
              dynamicInconsistencyRisks[0]!.commitment_description,
            risk_type: dynamicInconsistencyRisks[0]!.risk_type,
            durability: dynamicInconsistencyRisks[0]!.durability,
            evidence_refs: [],
            affected_games: dynamicInconsistencyRisks[0]!.affected_games,
            mitigation: dynamicInconsistencyRisks[0]!.mitigation,
          },
        },
      ],
      entity_previews: [
        createEntityPreview("dynamic_inconsistency_risk", "add", null, {
          player_id: dynamicInconsistencyRisks[0]!.player_id,
          risk_type: dynamicInconsistencyRisks[0]!.risk_type,
          durability: dynamicInconsistencyRisks[0]!.durability,
        }),
      ],
    }),
  ];
}

export function runPhase4History(
  context: Phase34RunnerContext,
): HistoricalGameResult {
  const playerIds = Object.keys(context.canonical.players);
  const games = Object.values(context.canonical.games);
  if (playerIds.length < 2 || games.length === 0) {
    return {
      phase: 4,
      status: {
        status: "failed",
        phase: 4,
        execution_id: context.phaseExecution.id,
        retriable: true,
        error:
          "Phase 4 requires accepted players and a baseline game from Phase 3.",
      },
      repeated_game_map: [],
      patterns_found: [],
      trust_assessment: [],
      dynamic_inconsistency_risks: [],
      global_signaling_effects: [],
      baseline_recheck: {
        game_still_correct: false,
        revealed_repeated_not_oneshot: false,
        hidden_player_found: false,
        hidden_commitment_problem: false,
        hidden_type_uncertainty: false,
        cooperative_equilibria_eliminated: false,
        objective_function_changed: false,
        deterrence_compellence_reframed: false,
        revalidation_needed: false,
        revalidation_triggers: [],
      },
      proposals: [],
    };
  }

  const repeated_game_map = buildRepeatedGameMap(
    playerIds,
    context.analysisState.started_at,
  );
  const patterns_found: ProposedRepeatedGamePattern[] = [
    {
      game_id: games[0]!.id,
      pattern_type: descriptionContains(
        context.analysisState.event_description,
        "deception",
        "bluff",
      )
        ? "dual_track_deception"
        : "tit_for_tat",
      description:
        "The interaction history shows reciprocal responses to prior moves.",
      instances: repeated_game_map.map((entry) => ({
        date: entry.date,
        description: entry.description,
        evidence_refs: [],
      })),
      impact_on_trust:
        "Trust decays when punitive cycles dominate the interaction history.",
      impact_on_model:
        "The game behaves more like a repeated interaction than a one-shot exchange.",
    },
  ];

  const trust_assessment: ProposedTrustAssessment[] = [
    {
      assessor_player_id: playerIds[0]!,
      target_player_id: playerIds[1]!,
      level: descriptionContains(
        context.analysisState.event_description,
        "alliance",
        "cooperate",
      )
        ? "moderate"
        : "low",
      posterior_belief: createEstimate(
        0.42,
        "Posterior trust is constrained by recent punitive interactions.",
      ),
      evidence_refs: [],
      interaction_history_summary:
        "Past cooperation has repeatedly broken down under pressure.",
      driving_patterns: [],
      implications:
        "Low trust increases the value of enforceable commitments and visible costly signals.",
    },
  ];

  const dynamic_inconsistency_risks: ProposedDynamicInconsistencyRisk[] = [
    {
      player_id: playerIds[0]!,
      commitment_description:
        "Leadership incentives may drift after the immediate crisis window.",
      risk_type: descriptionContains(
        context.analysisState.event_description,
        "election",
        "vote",
      )
        ? "electoral_cycle"
        : "leadership_transition",
      durability: descriptionContains(
        context.analysisState.event_description,
        "volatile",
        "transition",
      )
        ? "fragile"
        : "moderate",
      evidence_refs: [],
      affected_games: [asEntityRef("game", games[0]!.id)],
      mitigation:
        "Tie commitments to observable milestones or third-party verification.",
    },
  ];

  const revalidationNeeded =
    trust_assessment[0]!.level === "low" ||
    dynamic_inconsistency_risks[0]!.durability === "fragile";

  const proposals = buildPhase4Proposals({
    context,
    gameId: games[0]!.id,
    patterns: patterns_found,
    trustAssessment: trust_assessment,
    dynamicInconsistencyRisks: dynamic_inconsistency_risks,
  });

  return {
    phase: 4,
    status: {
      status: "complete",
      phase: 4,
      execution_id: context.phaseExecution.id,
      retriable: true,
    } satisfies PhaseResult,
    repeated_game_map,
    patterns_found,
    trust_assessment,
    dynamic_inconsistency_risks,
    global_signaling_effects: [
      "External observers will update beliefs based on whether costly commitments are honored.",
    ],
    baseline_recheck: {
      game_still_correct: !revalidationNeeded,
      revealed_repeated_not_oneshot: true,
      hidden_player_found: false,
      hidden_commitment_problem:
        dynamic_inconsistency_risks[0]!.durability === "fragile",
      hidden_type_uncertainty: trust_assessment[0]!.level === "low",
      cooperative_equilibria_eliminated: false,
      objective_function_changed:
        dynamic_inconsistency_risks[0]!.durability === "fragile",
      deterrence_compellence_reframed: false,
      revalidation_needed: revalidationNeeded,
      revalidation_triggers: revalidationNeeded
        ? [
            dynamic_inconsistency_risks[0]!.durability === "fragile"
              ? "objective_function_changed"
              : "repeated_dominates_oneshot",
          ]
        : [],
    },
    proposals,
  };
}
