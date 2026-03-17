import type { CanonicalStore, GameEdge, GameNode } from '../types/canonical'
import type { EstimateValue } from '../types/estimates'
import type { Formalization, NormalFormModel, ExtensiveFormModel } from '../types/formalizations'

export const EXTENSIVE_FORM_CYCLE_ERROR = 'Extensive-form graph must be acyclic from the root node.'

export interface NumericEstimate {
  value: number
  min?: number
  max?: number
  confidence: number
  usedMidpoint: boolean
  representation: EstimateValue['representation']
}

export function readEstimateNumeric(estimate: EstimateValue): NumericEstimate | null {
  if (typeof estimate.value === 'number') {
    return {
      value: estimate.value,
      confidence: estimate.confidence,
      usedMidpoint: false,
      representation: estimate.representation,
    }
  }

  if (typeof estimate.min === 'number' && typeof estimate.max === 'number') {
    return {
      value: (estimate.min + estimate.max) / 2,
      min: estimate.min,
      max: estimate.max,
      confidence: estimate.confidence,
      usedMidpoint: true,
      representation: estimate.representation,
    }
  }

  if (typeof estimate.ordinal_rank === 'number') {
    return {
      value: estimate.ordinal_rank,
      confidence: estimate.confidence,
      usedMidpoint: false,
      representation: estimate.representation,
    }
  }

  return null
}

export function isCardinalLike(estimate: EstimateValue): boolean {
  return (
    typeof estimate.value === 'number' ||
    (typeof estimate.min === 'number' && typeof estimate.max === 'number')
  )
}

export function isOrdinalOnly(estimate: EstimateValue): boolean {
  return estimate.representation === 'ordinal_rank' && typeof estimate.ordinal_rank === 'number'
}

export function getFormalizationNodes(
  canonical: CanonicalStore,
  formalizationId: string,
): GameNode[] {
  return Object.values(canonical.nodes).filter((node) => node.formalization_id === formalizationId)
}

export function getFormalizationEdges(
  canonical: CanonicalStore,
  formalizationId: string,
): GameEdge[] {
  return Object.values(canonical.edges).filter((edge) => edge.formalization_id === formalizationId)
}

export function getNormalFormPlayers(formalization: NormalFormModel): string[] {
  return Object.keys(formalization.strategies)
}

export function getNormalFormShape(formalization: NormalFormModel): {
  players: string[]
  rowPlayerId: string | null
  colPlayerId: string | null
  rowStrategies: string[]
  colStrategies: string[]
} {
  const players = getNormalFormPlayers(formalization)
  const rowPlayerId = players[0] ?? null
  const colPlayerId = players[1] ?? null

  return {
    players,
    rowPlayerId,
    colPlayerId,
    rowStrategies: rowPlayerId ? [...(formalization.strategies[rowPlayerId] ?? [])] : [],
    colStrategies: colPlayerId ? [...(formalization.strategies[colPlayerId] ?? [])] : [],
  }
}

export function getFormalizationAssumptionIds(
  formalization: Formalization,
  canonical: CanonicalStore,
): string[] {
  const ids = new Set<string>(formalization.assumptions)

  if (formalization.kind === 'extensive_form') {
    for (const node of getFormalizationNodes(canonical, formalization.id)) {
      for (const assumptionId of node.assumptions ?? []) {
        ids.add(assumptionId)
      }
    }

    for (const edge of getFormalizationEdges(canonical, formalization.id)) {
      for (const assumptionId of edge.assumptions ?? []) {
        ids.add(assumptionId)
      }
    }
  }

  return [...ids]
}

export function collectRelevantEstimates(
  formalization: Formalization,
  canonical: CanonicalStore,
): EstimateValue[] {
  const estimates: EstimateValue[] = []

  if (formalization.kind === 'normal_form') {
    for (const cell of formalization.payoff_cells) {
      for (const payoff of Object.values(cell.payoffs)) {
        estimates.push(payoff)
      }
    }
    return estimates
  }

  if (formalization.kind === 'extensive_form') {
    for (const node of getFormalizationNodes(canonical, formalization.id)) {
      for (const payoff of Object.values(node.terminal_payoffs ?? {})) {
        estimates.push(payoff)
      }
    }

    for (const edge of getFormalizationEdges(canonical, formalization.id)) {
      for (const payoff of Object.values(edge.payoff_delta ?? {})) {
        estimates.push(payoff)
      }
    }

    return estimates
  }

  if (formalization.kind === 'repeated') {
    for (const discountModel of Object.values(formalization.discount_factors)) {
      estimates.push(discountModel.delta)
      if (discountModel.beta) {
        estimates.push(discountModel.beta)
      }
    }
    return estimates
  }

  if (formalization.kind === 'coalition' && formalization.solution_concept) {
    for (const payoff of Object.values(formalization.solution_concept.characteristic_function ?? {})) {
      estimates.push(payoff)
    }
    for (const payoff of Object.values(formalization.solution_concept.threat_points ?? {})) {
      estimates.push(payoff)
    }
    return estimates
  }

  if (formalization.kind === 'bargaining') {
    estimates.push(formalization.surplus)
    for (const payoff of Object.values(formalization.outside_options)) {
      estimates.push(payoff)
    }
    for (const payoff of Object.values(formalization.discount_factors)) {
      estimates.push(payoff)
    }
    return estimates
  }

  if (formalization.kind === 'evolutionary') {
    for (const row of Object.values(formalization.fitness_matrix)) {
      for (const payoff of Object.values(row)) {
        estimates.push(payoff)
      }
    }
    if (formalization.mutation_rate) {
      estimates.push(formalization.mutation_rate)
    }
    return estimates
  }

  return estimates
}

export function buildChanceWeightMap(
  formalization: ExtensiveFormModel,
  canonical: CanonicalStore,
): Map<string, number> {
  const weights = new Map<string, number>()
  for (const edge of getFormalizationEdges(canonical, formalization.id)) {
    if (typeof edge.chance_estimate?.value === 'number') {
      weights.set(edge.id, edge.chance_estimate.value)
    }
  }
  return weights
}

export function buildOutgoingEdgeMap(
  edges: ReadonlyArray<GameEdge>,
): Map<string, GameEdge[]> {
  const outgoingByNode = new Map<string, GameEdge[]>()
  for (const edge of edges) {
    outgoingByNode.set(edge.from, [...(outgoingByNode.get(edge.from) ?? []), edge])
  }
  return outgoingByNode
}

export function findReachableCycleNode(
  rootNodeId: string,
  outgoingByNode: ReadonlyMap<string, ReadonlyArray<GameEdge>>,
): string | null {
  const visiting = new Set<string>()
  const visited = new Set<string>()

  const visit = (nodeId: string): string | null => {
    if (visiting.has(nodeId)) {
      return nodeId
    }

    if (visited.has(nodeId)) {
      return null
    }

    visiting.add(nodeId)
    for (const edge of outgoingByNode.get(nodeId) ?? []) {
      const cycleNodeId = visit(edge.to)
      if (cycleNodeId) {
        return cycleNodeId
      }
    }
    visiting.delete(nodeId)
    visited.add(nodeId)
    return null
  }

  return visit(rootNodeId)
}

export function formatReachableCycleError(cycleNodeId?: string | null): string {
  return cycleNodeId
    ? `${EXTENSIVE_FORM_CYCLE_ERROR} Cycle detected at node "${cycleNodeId}".`
    : EXTENSIVE_FORM_CYCLE_ERROR
}
