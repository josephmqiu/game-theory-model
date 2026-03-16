import { solverKinds } from '../types/canonical'
import type { CanonicalStore, SolverKind } from '../types/canonical'
import type {
  Formalization,
  NormalFormModel,
  ExtensiveFormModel,
  BayesianGameModel,
} from '../types/formalizations'
import type { SolverGateResult, SolverRequirement } from '../types/readiness'
import {
  buildOutgoingEdgeMap,
  formatReachableCycleError,
  findReachableCycleNode,
  collectRelevantEstimates,
  getFormalizationEdges,
  getFormalizationNodes,
  getNormalFormShape,
  isOrdinalOnly,
  readEstimateNumeric,
} from './utils'

function createGateResult(
  eligible: boolean,
  blockers: string[],
  warnings: string[],
  completeness: number,
  confidenceFloor = 1,
): SolverGateResult {
  return {
    eligible,
    blockers,
    warnings,
    completeness: Math.max(0, Math.min(1, completeness)),
    confidence_floor: Math.max(0, Math.min(1, confidenceFloor)),
  }
}

function confidenceFloorForFormalization(
  formalization: Formalization,
  store: CanonicalStore,
): number {
  const confidences = collectRelevantEstimates(formalization, store).map((estimate) => estimate.confidence)
  return confidences.length > 0 ? Math.min(...confidences) : 1
}

function buildNormalFormCellCoverage(formalization: NormalFormModel): {
  expected: number
  actual: number
  complete: boolean
} {
  const { rowStrategies, colStrategies } = getNormalFormShape(formalization)
  const expected = rowStrategies.length * colStrategies.length
  const actual = formalization.payoff_cells.length
  const complete = expected > 0 && actual >= expected
  return { expected, actual, complete }
}

function normalFormBaseGate(
  formalization: Formalization,
  store: CanonicalStore,
): {
  formalization: NormalFormModel | null
  blockers: string[]
  warnings: string[]
  completeness: number
  confidenceFloor: number
} {
  if (formalization.kind !== 'normal_form') {
    return {
      formalization: null,
      blockers: ['Normal-form solvers require a normal-form formalization.'],
      warnings: [],
      completeness: 0,
      confidenceFloor: 1,
    }
  }

  const nf = formalization as NormalFormModel
  const { players, rowStrategies, colStrategies } = getNormalFormShape(nf)
  const blockers: string[] = []

  if (players.length === 0) {
    blockers.push('No players assigned.')
  }
  if (players.length > 2) {
    blockers.push('N-player equilibrium search is deferred. Use a 2-player formalization for M4 solvers.')
  }
  if (rowStrategies.length === 0 || colStrategies.length === 0) {
    blockers.push('No strategies defined for any player.')
  }

  const coverage = buildNormalFormCellCoverage(nf)
  if (!coverage.complete) {
    blockers.push('Missing payoff cells for one or more strategy profiles.')
  }

  const confidenceFloor = confidenceFloorForFormalization(formalization, store)
  return {
    formalization: nf,
    blockers,
    warnings: [],
    completeness: coverage.expected === 0 ? 0 : coverage.actual / coverage.expected,
    confidenceFloor,
  }
}

function checkNash(formalization: Formalization, store: CanonicalStore): SolverGateResult {
  const base = normalFormBaseGate(formalization, store)
  if (!base.formalization) {
    return createGateResult(false, base.blockers, base.warnings, 0, base.confidenceFloor)
  }

  const blockers = [...base.blockers]
  const warnings = [...base.warnings]
  const hasOrdinalOnlyPayoff = base.formalization.payoff_cells.some((cell) =>
    Object.values(cell.payoffs).some((payoff) => isOrdinalOnly(payoff)),
  )

  if (hasOrdinalOnlyPayoff) {
    blockers.push('Mixed-strategy Nash requires cardinal payoffs.')
  }

  return createGateResult(blockers.length === 0, blockers, warnings, base.completeness, base.confidenceFloor)
}

function checkDominance(formalization: Formalization, store: CanonicalStore): SolverGateResult {
  const base = normalFormBaseGate(formalization, store)
  if (!base.formalization) {
    return createGateResult(false, base.blockers, base.warnings, 0, base.confidenceFloor)
  }

  return createGateResult(base.blockers.length === 0, base.blockers, base.warnings, base.completeness, base.confidenceFloor)
}

function checkExpectedUtility(formalization: Formalization, store: CanonicalStore): SolverGateResult {
  const base = normalFormBaseGate(formalization, store)
  if (!base.formalization) {
    return createGateResult(false, base.blockers, base.warnings, 0, base.confidenceFloor)
  }

  return createGateResult(base.blockers.length === 0, base.blockers, base.warnings, base.completeness, base.confidenceFloor)
}

function checkBackwardInduction(formalization: Formalization, store: CanonicalStore): SolverGateResult {
  if (formalization.kind !== 'extensive_form') {
    return createGateResult(false, ['Backward induction requires an extensive-form formalization.'], [], 0)
  }

  const ef = formalization as ExtensiveFormModel
  const blockers: string[] = []
  const warnings: string[] = []
  const nodes = getFormalizationNodes(store, ef.id)
  const edges = getFormalizationEdges(store, ef.id)

  if (!ef.root_node_id || !store.nodes[ef.root_node_id]) {
    blockers.push('Root node not found.')
  }

  if (nodes.length === 0 || edges.length === 0) {
    blockers.push('Ordered tree requires nodes and edges.')
  }

  const outgoingByNode = new Map<string, number>()
  for (const edge of edges) {
    outgoingByNode.set(edge.from, (outgoingByNode.get(edge.from) ?? 0) + 1)
  }

  if (ef.root_node_id) {
    const cycleNodeId = findReachableCycleNode(ef.root_node_id, buildOutgoingEdgeMap(edges))
    if (cycleNodeId) {
      blockers.push(formatReachableCycleError(cycleNodeId))
    }
  }

  const leaves = nodes.filter((node) => (outgoingByNode.get(node.id) ?? 0) === 0)
  if (leaves.length === 0) {
    blockers.push('No terminal nodes found.')
  }

  const leavesWithoutPayoffs = leaves.filter(
    (node) => Object.keys(node.terminal_payoffs ?? {}).length === 0,
  )
  if (leavesWithoutPayoffs.length > 0) {
    blockers.push('Terminal payoffs are missing on one or more leaf nodes.')
  }

  for (const informationSet of ef.information_sets) {
    if (informationSet.node_ids.length < 2) {
      warnings.push(`Information set ${informationSet.id} contains a single node.`)
    }
  }

  return createGateResult(
    blockers.length === 0,
    blockers,
    warnings,
    nodes.length === 0 ? 0 : (nodes.length - leavesWithoutPayoffs.length) / nodes.length,
    confidenceFloorForFormalization(formalization, store),
  )
}

function checkBayesianUpdate(formalization: Formalization, store: CanonicalStore): SolverGateResult {
  if (formalization.kind !== 'bayesian') {
    return createGateResult(false, ['Bayesian update requires a Bayesian formalization.'], [], 0)
  }

  const bayesian = formalization as BayesianGameModel
  const blockers: string[] = []
  if (bayesian.priors.length === 0) {
    blockers.push('Prior distributions not defined.')
  }
  if (Object.keys(bayesian.player_types).length === 0) {
    blockers.push('Player types not specified.')
  }
  if (!bayesian.signal_structure || bayesian.signal_structure.signals.length === 0) {
    blockers.push('Signal structure required for Bayesian updating.')
  }

  return createGateResult(
    blockers.length === 0,
    blockers,
    [],
    blockers.length === 0 ? 1 : 0.4,
    confidenceFloorForFormalization(formalization, store),
  )
}

function notImplementedGate(message: string): SolverGateResult {
  return createGateResult(false, [message], [], 0)
}

export const solverRequirementTable: Record<SolverKind, SolverRequirement> = {
  nash: { solver: 'nash', check: checkNash },
  dominance: { solver: 'dominance', check: checkDominance },
  expected_utility: { solver: 'expected_utility', check: checkExpectedUtility },
  backward_induction: { solver: 'backward_induction', check: checkBackwardInduction },
  bayesian_update: { solver: 'bayesian_update', check: checkBayesianUpdate },
  cascade: {
    solver: 'cascade',
    check: (_formalization, store) =>
      createGateResult(
        Object.keys(store.cross_game_links).length > 0,
        Object.keys(store.cross_game_links).length > 0
          ? []
          : ['Cascade solver requires at least one typed cross-game link.'],
        [],
        Object.keys(store.cross_game_links).length > 0 ? 1 : 0,
      ),
  },
  simulation: {
    solver: 'simulation',
    check: (formalization, store) => {
      const nodes = getFormalizationNodes(store, formalization.id).length
      const edges = getFormalizationEdges(store, formalization.id).length
      const game = store.games[formalization.game_id]
      const eligible = nodes > 0 && edges > 0 && (game?.players.length ?? 0) > 0
      return createGateResult(
        eligible,
        eligible ? [] : ['Simulation requires nodes, edges, and at least one assigned player.'],
        [],
        eligible ? 1 : 0.4,
        confidenceFloorForFormalization(formalization, store),
      )
    },
  },
  bargaining: {
    solver: 'bargaining',
    check: () => notImplementedGate('Bargaining solver not yet implemented.'),
  },
  evolutionary: {
    solver: 'evolutionary',
    check: () => notImplementedGate('Evolutionary solver not yet implemented.'),
  },
  correlated_equilibrium: {
    solver: 'correlated_equilibrium',
    check: () => notImplementedGate('Correlated equilibrium solver not yet implemented.'),
  },
  credible_commitment: {
    solver: 'credible_commitment',
    check: () => notImplementedGate('Credible commitment solver not yet implemented.'),
  },
  game_classifier: {
    solver: 'game_classifier',
    check: () => notImplementedGate('Game classifier not yet implemented.'),
  },
  mechanism_design: {
    solver: 'mechanism_design',
    check: () => notImplementedGate('Mechanism design solver not yet implemented.'),
  },
}

export function checkSolverRequirement(
  solver: SolverKind,
  formalization: Formalization,
  store: CanonicalStore,
): SolverGateResult {
  return solverRequirementTable[solver].check(formalization, store)
}

export function candidateSolversForFormalization(formalization: Formalization): SolverKind[] {
  switch (formalization.kind) {
    case 'normal_form':
      return ['nash', 'dominance', 'expected_utility']
    case 'extensive_form':
      return ['backward_induction']
    case 'bayesian':
      return ['bayesian_update']
    case 'repeated':
      return ['simulation']
    case 'coalition':
      return ['cascade']
    default:
      return solverKinds.filter((solver) => solver !== 'cascade' && solver !== 'simulation')
  }
}
