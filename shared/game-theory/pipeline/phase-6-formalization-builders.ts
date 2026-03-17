import type { Command } from "../engine/commands";
import type { CanonicalStore } from "../types";
import type {
  BargainingFormalization,
  BayesianGameModel,
  ExtensiveFormModel,
  NormalFormModel,
  RepeatedGameModel,
  SignalingFormalization,
} from "../types/formalizations";
import { createEntityId } from "./helpers";
import { createStructuredEstimate } from "./phase-6-shared";
import type { PlannedFormalization } from "./phase-6-shared";

export function buildNormalFormPayload(
  _formalizationId: string,
  gameId: string,
  players: string[],
): Omit<NormalFormModel, "id"> {
  const [rowPlayerId, colPlayerId] = players;
  const rowStrategies = ["Escalate", "Hold"];
  const colStrategies = ["Resist", "Accommodate"];

  return {
    game_id: gameId,
    kind: "normal_form",
    purpose: "computational",
    abstraction_level: "moderate",
    assumptions: [],
    strategies: {
      [rowPlayerId!]: rowStrategies,
      [colPlayerId!]: colStrategies,
    },
    payoff_cells: buildStructuredNormalFormPayoffCells({
      rowPlayerId: rowPlayerId ?? null,
      colPlayerId: colPlayerId ?? null,
      rowStrategies,
      colStrategies,
    }),
  };
}

export function buildStructuredNormalFormPayoffCells(params: {
  rowPlayerId: string | null;
  colPlayerId: string | null;
  rowStrategies: string[];
  colStrategies: string[];
}): NormalFormModel["payoff_cells"] {
  if (!params.rowPlayerId || !params.colPlayerId) {
    return [];
  }

  return params.rowStrategies.flatMap((rowStrategy, rowIndex) =>
    params.colStrategies.map((colStrategy, colIndex) => ({
      strategy_profile: {
        [params.rowPlayerId!]: rowStrategy,
        [params.colPlayerId!]: colStrategy,
      },
      payoffs: {
        [params.rowPlayerId!]: createStructuredEstimate({
          representation: "interval_estimate",
          min: 1 + rowIndex,
          max: 3 + colIndex,
          rationale: "Structured cardinal band for baseline payoff comparison.",
        }),
        [params.colPlayerId!]: createStructuredEstimate({
          representation: "interval_estimate",
          min: 1 + colIndex,
          max: 3 + rowIndex,
          rationale: "Structured cardinal band for baseline payoff comparison.",
        }),
      },
    })),
  );
}

export function buildNormalFormPayoffCellsForExisting(
  formalization: NormalFormModel,
): NormalFormModel["payoff_cells"] {
  const playerIds = Object.keys(formalization.strategies);
  const rowPlayerId = playerIds[0] ?? null;
  const colPlayerId = playerIds[1] ?? null;
  const rowStrategies = rowPlayerId
    ? (formalization.strategies[rowPlayerId] ?? [])
    : [];
  const colStrategies = colPlayerId
    ? (formalization.strategies[colPlayerId] ?? [])
    : [];

  return buildStructuredNormalFormPayoffCells({
    rowPlayerId,
    colPlayerId,
    rowStrategies,
    colStrategies,
  });
}

export function extractExtensiveNodeIds(
  canonical: CanonicalStore,
  formalizationId: string,
): PlannedFormalization["node_ids"] | undefined {
  const nodes = Object.values(canonical.nodes).filter(
    (node) => node.formalization_id === formalizationId,
  );
  const formalization = canonical.formalizations[formalizationId];
  if (!formalization || formalization.kind !== "extensive_form") {
    return undefined;
  }

  const terminals = nodes.filter((node) => node.type === "terminal");
  if (terminals.length < 2) {
    return undefined;
  }

  return {
    root: formalization.root_node_id,
    accept: terminals[0]!.id,
    resist: terminals[1]!.id,
  };
}

export function buildExtensiveFormCommands(
  formalizationId: string,
  gameId: string,
  actingPlayerId: string,
): {
  payload: Omit<ExtensiveFormModel, "id">;
  commands: Command[];
  nodeIds: PlannedFormalization["node_ids"];
} {
  const rootId = createEntityId("game_node");
  const acceptId = createEntityId("game_node");
  const resistId = createEntityId("game_node");
  const acceptEdgeId = createEntityId("game_edge");
  const resistEdgeId = createEntityId("game_edge");

  return {
    payload: {
      game_id: gameId,
      kind: "extensive_form",
      purpose: "computational",
      abstraction_level: "moderate",
      assumptions: [],
      root_node_id: rootId,
      information_sets: [],
    },
    commands: [
      {
        kind: "add_game_node",
        id: rootId,
        payload: {
          formalization_id: formalizationId,
          actor: { kind: "player", player_id: actingPlayerId },
          type: "decision",
          label: "Opening move",
          available_actions: ["Escalate", "Delay"],
        },
      },
      {
        kind: "add_game_node",
        id: acceptId,
        payload: {
          formalization_id: formalizationId,
          actor: { kind: "nature" },
          type: "terminal",
          label: "Accommodation outcome",
        },
      },
      {
        kind: "add_game_node",
        id: resistId,
        payload: {
          formalization_id: formalizationId,
          actor: { kind: "nature" },
          type: "terminal",
          label: "Resistance outcome",
        },
      },
      {
        kind: "add_game_edge",
        id: acceptEdgeId,
        payload: {
          formalization_id: formalizationId,
          from: rootId,
          to: acceptId,
          label: "Escalate",
        },
      },
      {
        kind: "add_game_edge",
        id: resistEdgeId,
        payload: {
          formalization_id: formalizationId,
          from: rootId,
          to: resistId,
          label: "Delay",
        },
      },
    ],
    nodeIds: {
      root: rootId,
      accept: acceptId,
      resist: resistId,
    },
  };
}

export function buildRepeatedPayload(
  gameId: string,
  stageFormalizationId: string,
  players: string[],
): Omit<RepeatedGameModel, "id"> {
  return {
    game_id: gameId,
    kind: "repeated",
    purpose: "explanatory",
    abstraction_level: "moderate",
    assumptions: [],
    stage_formalization_id: stageFormalizationId,
    horizon: "indefinite",
    discount_factors: Object.fromEntries(
      players.map((playerId) => [
        playerId,
        {
          type: "exponential",
          delta: createStructuredEstimate({
            representation: "interval_estimate",
            min: 0.65,
            max: 0.9,
            rationale:
              "Ordinal-first scaffold converted to a broad continuation-value band.",
          }),
        },
      ]),
    ),
    equilibrium_selection: {
      criterion: "grim_trigger",
    },
  };
}

export function buildBayesianPayload(
  gameId: string,
  players: string[],
): Omit<BayesianGameModel, "id"> {
  const focalPlayer = players[0] ?? "player_a";
  return {
    game_id: gameId,
    kind: "bayesian",
    purpose: "computational",
    abstraction_level: "moderate",
    assumptions: [],
    player_types: {
      [focalPlayer]: [
        {
          label: "Resolved",
          prior_probability: 0.55,
          description: "High willingness to sustain pressure.",
        },
        {
          label: "Constrained",
          prior_probability: 0.45,
          description: "Higher cost from escalation or delay.",
        },
      ],
    },
    priors: [
      {
        player_id: focalPlayer,
        types: [
          { label: "Resolved", prior_probability: 0.55 },
          { label: "Constrained", prior_probability: 0.45 },
        ],
      },
    ],
    signal_structure: {
      signals: [
        {
          label: "Hardline statement",
          type_label: "Resolved",
          probability: 0.7,
        },
        {
          label: "Hardline statement",
          type_label: "Constrained",
          probability: 0.3,
        },
        {
          label: "Conciliatory signal",
          type_label: "Resolved",
          probability: 0.3,
        },
        {
          label: "Conciliatory signal",
          type_label: "Constrained",
          probability: 0.7,
        },
      ],
    },
  };
}

export function buildSignalingPayload(
  gameId: string,
): Omit<SignalingFormalization, "id"> {
  return {
    game_id: gameId,
    kind: "signaling",
    purpose: "explanatory",
    abstraction_level: "moderate",
    assumptions: [],
    sender_types: [
      {
        type_id: "resolved",
        label: "Resolved",
        prior_probability: createStructuredEstimate({
          representation: "interval_estimate",
          min: 0.45,
          max: 0.65,
          rationale: "Broad prior over sender type.",
        }),
      },
      {
        type_id: "constrained",
        label: "Constrained",
        prior_probability: createStructuredEstimate({
          representation: "interval_estimate",
          min: 0.35,
          max: 0.55,
          rationale: "Broad prior over sender type.",
        }),
      },
    ],
    messages: [
      {
        message_id: "hardline",
        label: "Hardline statement",
        cost_by_type: {
          resolved: createStructuredEstimate({
            representation: "interval_estimate",
            min: 0.1,
            max: 0.3,
            rationale: "Low reputational cost for resolved type.",
          }),
          constrained: createStructuredEstimate({
            representation: "interval_estimate",
            min: 0.4,
            max: 0.7,
            rationale: "Higher reputational cost for constrained type.",
          }),
        },
      },
    ],
    receiver_actions: [
      { action_id: "accommodate", label: "Accommodate" },
      { action_id: "test", label: "Test resolve" },
    ],
    equilibrium_concept: "semi_separating",
  };
}

export function buildBargainingPayload(
  gameId: string,
  players: string[],
): Omit<BargainingFormalization, "id"> {
  return {
    game_id: gameId,
    kind: "bargaining",
    purpose: "explanatory",
    abstraction_level: "moderate",
    assumptions: [],
    protocol: "alternating_offers",
    parties: players,
    outside_options: Object.fromEntries(
      players.map((playerId, index) => [
        playerId,
        createStructuredEstimate({
          representation: "interval_estimate",
          min: index + 1,
          max: index + 2.5,
          rationale: "Outside option band capturing fallback leverage.",
        }),
      ]),
    ),
    discount_factors: Object.fromEntries(
      players.map((playerId) => [
        playerId,
        createStructuredEstimate({
          representation: "interval_estimate",
          min: 0.6,
          max: 0.9,
          rationale: "Delay costs remain material but uncertain.",
        }),
      ]),
    ),
    surplus: createStructuredEstimate({
      representation: "interval_estimate",
      min: 4,
      max: 8,
      rationale: "Negotiated surplus remains broad but positive.",
    }),
    deadline: {
      rounds: createStructuredEstimate({
        representation: "interval_estimate",
        min: 2,
        max: 5,
        rationale: "Negotiating window is limited but not point-estimated.",
      }),
      pressure_model: "risk_of_breakdown",
    },
    first_mover: players[0],
  };
}
