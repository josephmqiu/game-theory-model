/**
 * Derived store — L3 computed state (solver results, readiness).
 * Ephemeral — not persisted. Recalculated on demand.
 */

import { createStore } from "zustand";
import type { CanonicalStore } from "shared/game-theory/types/canonical";
import type {
  ReadinessReport,
  SolverKind,
} from "shared/game-theory/types/readiness";
import type {
  SensitivityAnalysis,
  SolverResultUnion,
} from "shared/game-theory/types/solver-results";
import type { Formalization } from "shared/game-theory/types/formalizations";
import type { Command } from "shared/game-theory/engine/commands";
import { computeReadiness } from "shared/game-theory/compute/readiness";
import { solveNash } from "shared/game-theory/compute/nash";
import { eliminateDominance } from "shared/game-theory/compute/dominance";
import { computeExpectedUtility } from "shared/game-theory/compute/expected-utility";
import { solveBackwardInduction } from "shared/game-theory/compute/backward-induction";
import { computeBayesianUpdate } from "shared/game-theory/compute/bayesian";
import {
  analyzeSensitivity,
  buildSensitivitySummary,
} from "shared/game-theory/compute/sensitivity";

export interface DerivedState {
  readinessReportsByFormalization: Record<string, ReadinessReport>;
  solverResultsByFormalization: Record<
    string,
    Partial<Record<SolverKind, SolverResultUnion>>
  >;
  sensitivityByFormalizationAndSolver: Record<
    string,
    Partial<Record<SolverKind, SensitivityAnalysis>>
  >;
  dirtyFormalizations: Record<string, boolean>;
}

interface DerivedActions {
  markDirty: (formalizationIds: string[]) => void;
  resetDerived: () => void;
  ensureReadiness: (
    formalizationId: string,
    canonical: CanonicalStore,
  ) => ReadinessReport | null;
  runSolver: (
    formalizationId: string,
    solver: SolverKind,
    canonical: CanonicalStore,
  ) => SolverResultUnion | null;
  invalidateDerivedForCommand: (
    command: Command | null,
    previousCanonical: CanonicalStore,
    nextCanonical: CanonicalStore,
  ) => void;
}

type DerivedStore = DerivedState & DerivedActions;

function createInitialState(): DerivedState {
  return {
    readinessReportsByFormalization: {},
    solverResultsByFormalization: {},
    sensitivityByFormalizationAndSolver: {},
    dirtyFormalizations: {},
  };
}

// ── Solver dispatch ──

function solveForFormalization(
  formalization: Formalization,
  solver: SolverKind,
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
    default:
      return null;
  }
}

// ── Affected formalization detection ──

function allFormalizationIds(canonical: CanonicalStore): string[] {
  return Object.keys(canonical.formalizations);
}

function findFormalizationsForGame(
  canonical: CanonicalStore,
  gameId: string,
): string[] {
  return Object.values(canonical.formalizations)
    .filter((f) => f.game_id === gameId)
    .map((f) => f.id);
}

function findFormalizationsReferencingPlayer(
  canonical: CanonicalStore,
  playerId: string,
): string[] {
  const ids = new Set<string>();
  for (const formalization of Object.values(canonical.formalizations)) {
    const game = canonical.games[formalization.game_id];
    if (game?.players.includes(playerId)) {
      ids.add(formalization.id);
    }

    if (
      formalization.kind === "normal_form" &&
      Object.hasOwn(formalization.strategies, playerId)
    ) {
      ids.add(formalization.id);
    }

    if (formalization.kind === "extensive_form") {
      const hasNode = Object.values(canonical.nodes).some(
        (node) =>
          node.formalization_id === formalization.id &&
          node.actor.kind === "player" &&
          node.actor.player_id === playerId,
      );
      if (hasNode) {
        ids.add(formalization.id);
      }
    }
  }
  return [...ids];
}

function findFormalizationsReferencingAssumption(
  canonical: CanonicalStore,
  assumptionId: string,
): string[] {
  const ids = new Set<string>();
  for (const formalization of Object.values(canonical.formalizations)) {
    if (formalization.assumptions.includes(assumptionId)) {
      ids.add(formalization.id);
      continue;
    }

    const hasNodeRef = Object.values(canonical.nodes).some(
      (node) =>
        node.formalization_id === formalization.id &&
        (node.assumptions ?? []).includes(assumptionId),
    );
    const hasEdgeRef = Object.values(canonical.edges).some(
      (edge) =>
        edge.formalization_id === formalization.id &&
        (edge.assumptions ?? []).includes(assumptionId),
    );

    if (hasNodeRef || hasEdgeRef) {
      ids.add(formalization.id);
    }
  }
  return [...ids];
}

function collectAffectedFormalizationIds(
  command: Command | null,
  previousCanonical: CanonicalStore,
  nextCanonical: CanonicalStore,
): string[] {
  if (!command) {
    return allFormalizationIds(nextCanonical);
  }

  if (command.kind === "batch") {
    return command.commands.flatMap((nested) =>
      collectAffectedFormalizationIds(nested, previousCanonical, nextCanonical),
    );
  }

  if (
    command.kind.startsWith("add_formalization") ||
    command.kind.startsWith("update_formalization")
  ) {
    const id = (command as { payload?: { id?: string } }).payload?.id;
    return typeof id === "string" ? [id] : [];
  }

  if (command.kind === "delete_formalization") {
    return [(command as { payload: { id: string } }).payload.id];
  }

  if (command.kind === "update_payoff") {
    const payload = (command as { payload: { node_id: string } }).payload;
    const node =
      previousCanonical.nodes[payload.node_id] ??
      nextCanonical.nodes[payload.node_id];
    return node ? [node.formalization_id] : allFormalizationIds(nextCanonical);
  }

  if (command.kind === "update_normal_form_payoff") {
    return [
      (command as { payload: { formalization_id: string } }).payload
        .formalization_id,
    ];
  }

  if (
    command.kind === "attach_player_to_game" ||
    command.kind === "remove_player_from_game"
  ) {
    return findFormalizationsForGame(
      nextCanonical,
      (command as { payload: { game_id: string } }).payload.game_id,
    );
  }

  if (command.kind === "attach_formalization_to_game") {
    return [
      (command as { payload: { formalization_id: string } }).payload
        .formalization_id,
    ];
  }

  if (
    command.kind.startsWith("add_game_node") ||
    command.kind.startsWith("update_game_node")
  ) {
    const nodeId = (command as { payload?: { id?: string } }).payload?.id;
    const entity =
      typeof nodeId === "string"
        ? (nextCanonical.nodes[nodeId] ?? previousCanonical.nodes[nodeId])
        : null;
    return entity
      ? [entity.formalization_id]
      : allFormalizationIds(nextCanonical);
  }

  if (command.kind === "delete_game_node") {
    const entity =
      previousCanonical.nodes[
        (command as { payload: { id: string } }).payload.id
      ];
    return entity
      ? [entity.formalization_id]
      : allFormalizationIds(nextCanonical);
  }

  if (
    command.kind.startsWith("add_game_edge") ||
    command.kind.startsWith("update_game_edge")
  ) {
    const edgeId = (command as { payload?: { id?: string } }).payload?.id;
    const entity =
      typeof edgeId === "string"
        ? (nextCanonical.edges[edgeId] ?? previousCanonical.edges[edgeId])
        : null;
    return entity
      ? [entity.formalization_id]
      : allFormalizationIds(nextCanonical);
  }

  if (command.kind === "delete_game_edge") {
    const entity =
      previousCanonical.edges[
        (command as { payload: { id: string } }).payload.id
      ];
    return entity
      ? [entity.formalization_id]
      : allFormalizationIds(nextCanonical);
  }

  if (
    command.kind.startsWith("add_player") ||
    command.kind.startsWith("update_player") ||
    command.kind === "delete_player"
  ) {
    const playerId = (command as { payload?: { id?: string } }).payload?.id;
    return typeof playerId === "string"
      ? [
          ...new Set([
            ...findFormalizationsReferencingPlayer(previousCanonical, playerId),
            ...findFormalizationsReferencingPlayer(nextCanonical, playerId),
          ]),
        ]
      : allFormalizationIds(nextCanonical);
  }

  if (
    command.kind.startsWith("add_assumption") ||
    command.kind.startsWith("update_assumption") ||
    command.kind === "delete_assumption"
  ) {
    const assumptionId = (command as { payload?: { id?: string } }).payload?.id;
    return typeof assumptionId === "string"
      ? [
          ...new Set([
            ...findFormalizationsReferencingAssumption(
              previousCanonical,
              assumptionId,
            ),
            ...findFormalizationsReferencingAssumption(
              nextCanonical,
              assumptionId,
            ),
          ]),
        ]
      : allFormalizationIds(nextCanonical);
  }

  // mark_stale, clear_stale, trigger_revalidation, etc. → invalidate all
  return allFormalizationIds(nextCanonical);
}

// ── Pruning helper ──

function pruneRemovedFormalizations(
  state: DerivedState,
  canonical: CanonicalStore,
): Partial<DerivedState> {
  const validIds = new Set(Object.keys(canonical.formalizations));
  const filterRecord = <T>(record: Record<string, T>): Record<string, T> =>
    Object.fromEntries(
      Object.entries(record).filter(([id]) => validIds.has(id)),
    );

  return {
    readinessReportsByFormalization: filterRecord(
      state.readinessReportsByFormalization,
    ),
    solverResultsByFormalization: filterRecord(
      state.solverResultsByFormalization,
    ),
    sensitivityByFormalizationAndSolver: filterRecord(
      state.sensitivityByFormalizationAndSolver,
    ),
    dirtyFormalizations: filterRecord(state.dirtyFormalizations),
  };
}

// ── Store ──

export const derivedStore = createStore<DerivedStore>((set, get) => ({
  ...createInitialState(),

  markDirty(formalizationIds) {
    const ids = [...new Set(formalizationIds.filter(Boolean))];
    if (ids.length === 0) return;
    set({
      dirtyFormalizations: {
        ...get().dirtyFormalizations,
        ...Object.fromEntries(ids.map((id) => [id, true])),
      },
    });
  },

  resetDerived() {
    set(createInitialState());
  },

  ensureReadiness(formalizationId, canonical) {
    const formalization = canonical.formalizations[formalizationId];
    if (!formalization) return null;

    const state = get();
    if (
      !state.dirtyFormalizations[formalizationId] &&
      state.readinessReportsByFormalization[formalizationId]
    ) {
      return state.readinessReportsByFormalization[formalizationId];
    }

    const report = computeReadiness(formalization, canonical);
    set({
      readinessReportsByFormalization: {
        ...get().readinessReportsByFormalization,
        [formalizationId]: report,
      },
      dirtyFormalizations: {
        ...get().dirtyFormalizations,
        [formalizationId]: false,
      },
    });
    return report;
  },

  runSolver(formalizationId, solver, canonical) {
    const formalization = canonical.formalizations[formalizationId];
    if (!formalization) return null;

    // Ensure readiness is up to date
    get().ensureReadiness(formalizationId, canonical);

    const result = solveForFormalization(formalization, solver, canonical);
    if (!result) return null;

    if (result.status === "failed") {
      set({
        solverResultsByFormalization: {
          ...get().solverResultsByFormalization,
          [formalizationId]: {
            ...(get().solverResultsByFormalization[formalizationId] ?? {}),
            [solver]: result,
          },
        },
      });
      // Clear sensitivity for failed results
      const existingSens =
        get().sensitivityByFormalizationAndSolver[formalizationId] ?? {};
      const { [solver]: _removed, ...remainingSens } = existingSens;
      set({
        sensitivityByFormalizationAndSolver:
          Object.keys(remainingSens).length > 0
            ? {
                ...get().sensitivityByFormalizationAndSolver,
                [formalizationId]: remainingSens as Partial<
                  Record<SolverKind, SensitivityAnalysis>
                >,
              }
            : Object.fromEntries(
                Object.entries(
                  get().sensitivityByFormalizationAndSolver,
                ).filter(([key]) => key !== formalizationId),
              ),
      });
      return result;
    }

    const sensitivity = analyzeSensitivity(formalization, result, canonical);
    const enrichedResult = {
      ...result,
      sensitivity: buildSensitivitySummary(sensitivity),
    } satisfies SolverResultUnion;

    set({
      solverResultsByFormalization: {
        ...get().solverResultsByFormalization,
        [formalizationId]: {
          ...(get().solverResultsByFormalization[formalizationId] ?? {}),
          [solver]: enrichedResult,
        },
      },
      sensitivityByFormalizationAndSolver: sensitivity
        ? {
            ...get().sensitivityByFormalizationAndSolver,
            [formalizationId]: {
              ...(get().sensitivityByFormalizationAndSolver[formalizationId] ??
                {}),
              [solver]: sensitivity,
            },
          }
        : get().sensitivityByFormalizationAndSolver,
      dirtyFormalizations: {
        ...get().dirtyFormalizations,
        [formalizationId]: false,
      },
    });

    return enrichedResult;
  },

  invalidateDerivedForCommand(command, previousCanonical, nextCanonical) {
    const affected = collectAffectedFormalizationIds(
      command,
      previousCanonical,
      nextCanonical,
    );

    const state = get();
    const dirty = { ...state.dirtyFormalizations };
    for (const id of affected) {
      dirty[id] = true;
    }

    set({
      dirtyFormalizations: dirty,
      ...pruneRemovedFormalizations(state, nextCanonical),
    });
  },
}));

export function getDerivedState(): DerivedState {
  return derivedStore.getState();
}

export function resetDerivedState(): void {
  derivedStore.getState().resetDerived();
}
