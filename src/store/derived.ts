import { createStore } from 'zustand/vanilla'

import type { Command } from '../engine/commands'
import type { CanonicalStore, SolverKind } from '../types'
import type { ReadinessReport } from '../types/readiness'
import type { SensitivityAnalysis, SolverResultUnion } from '../types/solver-results'
import { computeReadiness } from '../compute/readiness'
import { solveNash } from '../compute/nash'
import { eliminateDominance } from '../compute/dominance'
import { computeExpectedUtility } from '../compute/expected-utility'
import { solveBackwardInduction } from '../compute/backward-induction'
import { computeBayesianUpdate } from '../compute/bayesian'
import { analyzeSensitivity, buildSensitivitySummary } from '../compute/sensitivity'

export interface DerivedState {
  readinessReportsByFormalization: Record<string, ReadinessReport>
  solverResultsByFormalization: Record<string, Partial<Record<SolverKind, SolverResultUnion>>>
  sensitivityByFormalizationAndSolver: Record<string, Partial<Record<SolverKind, SensitivityAnalysis>>>
  dirtyFormalizations: Record<string, boolean>
}

function createInitialState(): DerivedState {
  return {
    readinessReportsByFormalization: {},
    solverResultsByFormalization: {},
    sensitivityByFormalizationAndSolver: {},
    dirtyFormalizations: {},
  }
}

const derivedStore = createStore<DerivedState>(() => createInitialState())

function setFormalizationsDirty(formalizationIds: Iterable<string>): void {
  const ids = [...new Set([...formalizationIds].filter(Boolean))]
  if (ids.length === 0) {
    return
  }

  derivedStore.setState((state) => {
    const dirtyFormalizations = { ...state.dirtyFormalizations }
    for (const id of ids) {
      dirtyFormalizations[id] = true
    }
    return { ...state, dirtyFormalizations }
  })
}

function replaceSolverResult(
  formalizationId: string,
  solver: SolverKind,
  result: SolverResultUnion,
  sensitivity: SensitivityAnalysis | null,
): void {
  derivedStore.setState((state) => ({
    ...state,
    solverResultsByFormalization: {
      ...state.solverResultsByFormalization,
      [formalizationId]: {
        ...(state.solverResultsByFormalization[formalizationId] ?? {}),
        [solver]: result,
      },
    },
    sensitivityByFormalizationAndSolver: sensitivity
      ? {
          ...state.sensitivityByFormalizationAndSolver,
          [formalizationId]: {
            ...(state.sensitivityByFormalizationAndSolver[formalizationId] ?? {}),
            [solver]: sensitivity,
          },
        }
      : state.sensitivityByFormalizationAndSolver,
  }))
}

function clearSensitivity(formalizationId: string, solver: SolverKind): void {
  derivedStore.setState((state) => {
    const entry = { ...(state.sensitivityByFormalizationAndSolver[formalizationId] ?? {}) }
    delete entry[solver]
    return {
      ...state,
      sensitivityByFormalizationAndSolver: {
        ...state.sensitivityByFormalizationAndSolver,
        [formalizationId]: entry,
      },
    }
  })
}

export function getDerivedStore() {
  return derivedStore
}

export function resetDerivedState(): void {
  derivedStore.setState(createInitialState())
}

export function ensureReadiness(
  formalizationId: string,
  canonical: CanonicalStore,
): ReadinessReport | null {
  const formalization = canonical.formalizations[formalizationId]
  if (!formalization) {
    return null
  }

  const state = derivedStore.getState()
  if (!state.dirtyFormalizations[formalizationId] && state.readinessReportsByFormalization[formalizationId]) {
    return state.readinessReportsByFormalization[formalizationId]
  }

  const report = computeReadiness(formalization, canonical)
  derivedStore.setState((current) => ({
    ...current,
    readinessReportsByFormalization: {
      ...current.readinessReportsByFormalization,
      [formalizationId]: report,
    },
    dirtyFormalizations: {
      ...current.dirtyFormalizations,
      [formalizationId]: false,
    },
  }))
  return report
}

export function runSolver(
  formalizationId: string,
  solver: SolverKind,
  canonical: CanonicalStore,
): SolverResultUnion | null {
  const formalization = canonical.formalizations[formalizationId]
  if (!formalization) {
    return null
  }

  ensureReadiness(formalizationId, canonical)

  let result: SolverResultUnion | null = null
  switch (solver) {
    case 'nash':
      result = formalization.kind === 'normal_form' ? solveNash(formalization, canonical) : null
      break
    case 'dominance':
      result = formalization.kind === 'normal_form' ? eliminateDominance(formalization, canonical) : null
      break
    case 'expected_utility':
      result = formalization.kind === 'normal_form' ? computeExpectedUtility(formalization, canonical) : null
      break
    case 'backward_induction':
      result = formalization.kind === 'extensive_form' ? solveBackwardInduction(formalization, canonical) : null
      break
    case 'bayesian_update':
      result = formalization.kind === 'bayesian' ? computeBayesianUpdate(formalization, canonical) : null
      break
    default:
      result = null
  }

  if (!result) {
    return null
  }

  if (result.status === 'failed') {
    replaceSolverResult(formalizationId, solver, result, null)
    clearSensitivity(formalizationId, solver)
    return result
  }

  const sensitivity = analyzeSensitivity(formalization, result, canonical)
  const enrichedResult = {
    ...result,
    sensitivity: buildSensitivitySummary(sensitivity),
  } satisfies SolverResultUnion
  replaceSolverResult(formalizationId, solver, enrichedResult, sensitivity)

  derivedStore.setState((state) => ({
    ...state,
    dirtyFormalizations: {
      ...state.dirtyFormalizations,
      [formalizationId]: false,
    },
  }))

  return enrichedResult
}

function allFormalizationIds(canonical: CanonicalStore): string[] {
  return Object.keys(canonical.formalizations)
}

function findFormalizationsForGame(canonical: CanonicalStore, gameId: string): string[] {
  return Object.values(canonical.formalizations)
    .filter((formalization) => formalization.game_id === gameId)
    .map((formalization) => formalization.id)
}

function findFormalizationsReferencingPlayer(canonical: CanonicalStore, playerId: string): string[] {
  const ids = new Set<string>()
  for (const formalization of Object.values(canonical.formalizations)) {
    const game = canonical.games[formalization.game_id]
    if (game?.players.includes(playerId)) {
      ids.add(formalization.id)
    }

    if (formalization.kind === 'normal_form' && Object.hasOwn(formalization.strategies, playerId)) {
      ids.add(formalization.id)
    }

    if (formalization.kind === 'extensive_form') {
      const hasNode = Object.values(canonical.nodes).some(
        (node) =>
          node.formalization_id === formalization.id &&
          node.actor.kind === 'player' &&
          node.actor.player_id === playerId,
      )
      if (hasNode) {
        ids.add(formalization.id)
      }
    }
  }

  return [...ids]
}

function findFormalizationsReferencingAssumption(canonical: CanonicalStore, assumptionId: string): string[] {
  const ids = new Set<string>()
  for (const formalization of Object.values(canonical.formalizations)) {
    if (formalization.assumptions.includes(assumptionId)) {
      ids.add(formalization.id)
      continue
    }

    const hasNodeReference = Object.values(canonical.nodes).some(
      (node) =>
        node.formalization_id === formalization.id &&
        (node.assumptions ?? []).includes(assumptionId),
    )
    const hasEdgeReference = Object.values(canonical.edges).some(
      (edge) =>
        edge.formalization_id === formalization.id &&
        (edge.assumptions ?? []).includes(assumptionId),
    )

    if (hasNodeReference || hasEdgeReference) {
      ids.add(formalization.id)
    }
  }

  return [...ids]
}

function collectAffectedFormalizationIds(
  command: Command | null,
  previousCanonical: CanonicalStore,
  nextCanonical: CanonicalStore,
): string[] {
  if (!command) {
    return allFormalizationIds(nextCanonical)
  }

  if (command.kind === 'batch') {
    return command.commands.flatMap((nested) =>
      collectAffectedFormalizationIds(nested, previousCanonical, nextCanonical),
    )
  }

  if (command.kind.startsWith('add_formalization') || command.kind.startsWith('update_formalization')) {
    const id = typeof (command as { payload?: { id?: string } }).payload?.id === 'string'
      ? (command as { payload: { id: string } }).payload.id
      : undefined
    return id ? [id] : []
  }

  if (command.kind === 'delete_formalization') {
    return [command.payload.id]
  }

  if (command.kind === 'update_payoff') {
    const node = previousCanonical.nodes[command.payload.node_id] ?? nextCanonical.nodes[command.payload.node_id]
    return node ? [node.formalization_id] : allFormalizationIds(nextCanonical)
  }

  if (command.kind === 'update_normal_form_payoff') {
    return [command.payload.formalization_id]
  }

  if (command.kind === 'attach_player_to_game' || command.kind === 'remove_player_from_game') {
    return findFormalizationsForGame(nextCanonical, command.payload.game_id)
  }

  if (command.kind === 'attach_formalization_to_game') {
    return [command.payload.formalization_id]
  }

  if (command.kind.startsWith('add_game_node') || command.kind.startsWith('update_game_node')) {
    const nodeId = typeof (command as { payload?: { id?: string } }).payload?.id === 'string'
      ? (command as { payload: { id: string } }).payload.id
      : undefined
    const entity = nodeId
      ? nextCanonical.nodes[nodeId] ?? previousCanonical.nodes[nodeId]
      : null
    return entity ? [entity.formalization_id] : allFormalizationIds(nextCanonical)
  }

  if (command.kind === 'delete_game_node') {
    const entity = previousCanonical.nodes[command.payload.id]
    return entity ? [entity.formalization_id] : allFormalizationIds(nextCanonical)
  }

  if (command.kind.startsWith('add_game_edge') || command.kind.startsWith('update_game_edge')) {
    const edgeId = typeof (command as { payload?: { id?: string } }).payload?.id === 'string'
      ? (command as { payload: { id: string } }).payload.id
      : undefined
    const entity = edgeId
      ? nextCanonical.edges[edgeId] ?? previousCanonical.edges[edgeId]
      : null
    return entity ? [entity.formalization_id] : allFormalizationIds(nextCanonical)
  }

  if (command.kind === 'delete_game_edge') {
    const entity = previousCanonical.edges[command.payload.id]
    return entity ? [entity.formalization_id] : allFormalizationIds(nextCanonical)
  }

  if (command.kind.startsWith('add_player') || command.kind.startsWith('update_player') || command.kind === 'delete_player') {
    const playerId = typeof (command as { payload?: { id?: string } }).payload?.id === 'string'
      ? (command as { payload: { id: string } }).payload.id
      : undefined
    return playerId ? findFormalizationsReferencingPlayer(nextCanonical, playerId) : allFormalizationIds(nextCanonical)
  }

  if (command.kind.startsWith('add_assumption') || command.kind.startsWith('update_assumption') || command.kind === 'delete_assumption') {
    const assumptionId = typeof (command as { payload?: { id?: string } }).payload?.id === 'string'
      ? (command as { payload: { id: string } }).payload.id
      : undefined
    return assumptionId
      ? findFormalizationsReferencingAssumption(nextCanonical, assumptionId)
      : allFormalizationIds(nextCanonical)
  }

  if (
    command.kind === 'mark_stale' ||
    command.kind === 'clear_stale' ||
    command.kind === 'trigger_revalidation' ||
    command.kind === 'apply_cascade_effect' ||
    command.kind === 'promote_play_result'
  ) {
    return allFormalizationIds(nextCanonical)
  }

  return allFormalizationIds(nextCanonical)
}

export function invalidateDerivedForCommand(
  command: Command | null,
  previousCanonical: CanonicalStore,
  nextCanonical: CanonicalStore,
): void {
  const affected = collectAffectedFormalizationIds(command, previousCanonical, nextCanonical)
  setFormalizationsDirty(affected)
}
