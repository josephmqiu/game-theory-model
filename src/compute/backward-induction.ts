import type { CanonicalStore, GameEdge, GameNode } from '../types/canonical'
import type { ExtensiveFormModel } from '../types/formalizations'
import type { BackwardInductionResult, SubgameValue } from '../types/solver-results'
import { checkSolverGate, computeReadiness } from './readiness'
import { getFormalizationEdges, getFormalizationNodes, readEstimateNumeric } from './utils'

interface NodeEvaluation {
  payoffs: Record<string, number>
  chosenEdgeId: string | null
  subgameValue: SubgameValue | null
  warnings: string[]
}

function baseResult(formalization: ExtensiveFormModel, store: CanonicalStore): BackwardInductionResult {
  return {
    id: crypto.randomUUID(),
    formalization_id: formalization.id,
    solver: 'backward_induction',
    computed_at: new Date().toISOString(),
    readiness_snapshot: computeReadiness(formalization, store).readiness,
    status: 'success',
    warnings: [],
    meta: {
      method_id: 'backward_induction_uniform_belief',
      method_label: 'Backward Induction',
      limitations: [],
      assumptions_used: [],
    },
    solution_path: [],
    subgame_values: {},
    optimal_strategies: {},
  }
}

function getActingPlayerId(node: GameNode, canonical: CanonicalStore, formalization: ExtensiveFormModel): string {
  if (node.actor.kind === 'player') {
    return node.actor.player_id
  }

  return canonical.games[formalization.game_id]?.players[0] ?? 'unknown_player'
}

export function solveBackwardInduction(
  formalization: ExtensiveFormModel,
  store: CanonicalStore,
): BackwardInductionResult {
  const gate = checkSolverGate('backward_induction', formalization, store)
  const result = baseResult(formalization, store)

  if (!gate.eligible) {
    return {
      ...result,
      status: 'failed',
      warnings: [...gate.blockers, ...gate.warnings],
      error: gate.blockers[0] ?? 'Solver readiness gate failed.',
    }
  }

  const nodes = getFormalizationNodes(store, formalization.id)
  const edges = getFormalizationEdges(store, formalization.id)
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const outgoingByNode = new Map<string, GameEdge[]>()
  for (const edge of edges) {
    outgoingByNode.set(edge.from, [...(outgoingByNode.get(edge.from) ?? []), edge])
  }

  const informationSetByNode = new Map<string, ExtensiveFormModel['information_sets'][number]>()
  for (const informationSet of formalization.information_sets) {
    for (const nodeId of informationSet.node_ids) {
      informationSetByNode.set(nodeId, informationSet)
    }
  }

  const memo = new Map<string, NodeEvaluation>()
  const infoSetMemo = new Map<string, Map<string, NodeEvaluation>>()
  const warnings = new Set<string>()
  let usesUniformBeliefs = false

  const depthMemo = new Map<string, number>()
  const computeDepth = (nodeId: string, depth = 0): void => {
    if (depthMemo.has(nodeId)) {
      return
    }
    depthMemo.set(nodeId, depth)
    for (const edge of outgoingByNode.get(nodeId) ?? []) {
      computeDepth(edge.to, depth + 1)
    }
  }
  computeDepth(formalization.root_node_id, 0)

  for (const informationSet of formalization.information_sets) {
    const depths = informationSet.node_ids.map((nodeId) => depthMemo.get(nodeId) ?? -1)
    if (new Set(depths).size > 1) {
      return {
        ...result,
        status: 'failed',
        warnings: [`Information set ${informationSet.id} spans different tree depths.`],
        error: `Information set ${informationSet.id} spans different tree depths.`,
      }
    }
  }

  const buildPayoffDifference = (
    referencePayoffs: Record<string, number>,
    comparisonPayoffs: Record<string, number>,
  ): Record<string, number> =>
    Object.fromEntries(
      Object.entries(referencePayoffs).map(([playerId, payoff]) => [
        playerId,
        Number((payoff - (comparisonPayoffs[playerId] ?? 0)).toFixed(4)),
      ]),
    )

  const createFallbackEvaluation = (warning: string): NodeEvaluation => ({
    payoffs: {},
    chosenEdgeId: null,
    subgameValue: null,
    warnings: [warning],
  })

  const evaluateTerminalNode = (node: GameNode, nodeId: string): NodeEvaluation => {
    const payoffs: Record<string, number> = {}
    for (const [playerId, estimate] of Object.entries(node.terminal_payoffs ?? {})) {
      const numeric = readEstimateNumeric(estimate)
      if (numeric) {
        payoffs[playerId] = numeric.value
      }
    }

    if (Object.keys(payoffs).length === 0) {
      warnings.add(`Terminal node ${node.label} is missing payoffs.`)
    }

    const evaluation: NodeEvaluation = {
      payoffs,
      chosenEdgeId: null,
      subgameValue: null,
      warnings: [],
    }
    memo.set(nodeId, evaluation)
    return evaluation
  }

  const evaluateChanceNode = (
    node: GameNode,
    outgoing: GameEdge[],
    evaluateNode: (nodeId: string) => NodeEvaluation,
  ): NodeEvaluation => {
    const payoffs: Record<string, number> = {}
    for (const edge of outgoing) {
      const childEvaluation = evaluateNode(edge.to)
      const weight = edge.chance_estimate?.value ?? 1 / Math.max(outgoing.length, 1)
      for (const [playerId, payoff] of Object.entries(childEvaluation.payoffs)) {
        payoffs[playerId] = (payoffs[playerId] ?? 0) + payoff * weight
      }
    }

    return {
      payoffs,
      chosenEdgeId: outgoing[0]?.id ?? null,
      subgameValue: outgoing[0]
        ? {
            node_id: node.id,
            player_payoffs: payoffs,
            chosen_edge_id: outgoing[0].id,
            alternative_edges: outgoing.slice(1).map((edge) => ({
              edge_id: edge.id,
              player_payoffs: evaluateNode(edge.to).payoffs,
              payoff_difference: {},
            })),
          }
        : null,
      warnings: [],
    }
  }

  const evaluateDecisionNode = (
    node: GameNode,
    outgoing: GameEdge[],
    evaluateNode: (nodeId: string) => NodeEvaluation,
  ): NodeEvaluation => {
    const actingPlayerId = getActingPlayerId(node, store, formalization)
    let chosenEdge: GameEdge | null = null
    let chosenEvaluation: NodeEvaluation | null = null
    let bestScore = Number.NEGATIVE_INFINITY
    const alternatives: SubgameValue['alternative_edges'] = []

    for (const edge of outgoing) {
      const childEvaluation = evaluateNode(edge.to)
      const score = childEvaluation.payoffs[actingPlayerId] ?? 0
      if (score > bestScore) {
        if (chosenEdge && chosenEvaluation) {
          alternatives.push({
            edge_id: chosenEdge.id,
            player_payoffs: chosenEvaluation.payoffs,
            payoff_difference: buildPayoffDifference(chosenEvaluation.payoffs, childEvaluation.payoffs),
          })
        }
        bestScore = score
        chosenEdge = edge
        chosenEvaluation = childEvaluation
      } else {
        alternatives.push({
          edge_id: edge.id,
          player_payoffs: childEvaluation.payoffs,
          payoff_difference: chosenEvaluation
            ? buildPayoffDifference(chosenEvaluation.payoffs, childEvaluation.payoffs)
            : {},
        })
      }
    }

    return {
      payoffs: chosenEvaluation?.payoffs ?? {},
      chosenEdgeId: chosenEdge?.id ?? null,
      subgameValue: chosenEdge
        ? {
            node_id: node.id,
            player_payoffs: chosenEvaluation?.payoffs ?? {},
            chosen_edge_id: chosenEdge.id,
            alternative_edges: alternatives,
          }
        : null,
      warnings: [],
    }
  }

  const evaluateInformationSet = (
    node: GameNode,
    informationSet: ExtensiveFormModel['information_sets'][number],
    evaluateNode: (nodeId: string) => NodeEvaluation,
  ): NodeEvaluation => {
    if (infoSetMemo.has(informationSet.id)) {
      const cached = infoSetMemo.get(informationSet.id)?.get(node.id)
      if (cached) {
        memo.set(node.id, cached)
        return cached
      }
    }

    const nodeIds = informationSet.node_ids.filter((candidateId) => nodeById.has(candidateId))
    const actionLabels = [...new Set(
      nodeIds.flatMap((candidateId) => (outgoingByNode.get(candidateId) ?? []).map((edge) => edge.action_id ?? edge.label)),
    )]
    const beliefs = informationSet.beliefs
    if (!beliefs) {
      usesUniformBeliefs = true
    }

    let bestAction = actionLabels[0] ?? null
    let bestScore = Number.NEGATIVE_INFINITY
    const chosenByNode = new Map<string, NodeEvaluation>()

    for (const actionLabel of actionLabels) {
      let weightedScore = 0
      const localEvaluations = new Map<string, NodeEvaluation>()

      for (const candidateId of nodeIds) {
        const candidateNode = nodeById.get(candidateId)
        if (!candidateNode) {
          continue
        }

        const candidateEdges = (outgoingByNode.get(candidateId) ?? []).filter(
          (edge) => (edge.action_id ?? edge.label) === actionLabel,
        )
        const selectedEdge = candidateEdges[0]
        if (!selectedEdge) {
          continue
        }

        const childEvaluation = evaluateNode(selectedEdge.to)
        const weight = beliefs?.[candidateId] ?? 1 / Math.max(nodeIds.length, 1)
        weightedScore += (childEvaluation.payoffs[informationSet.player_id] ?? 0) * weight

        localEvaluations.set(candidateId, {
          payoffs: childEvaluation.payoffs,
          chosenEdgeId: selectedEdge.id,
          subgameValue: {
            node_id: candidateNode.id,
            player_payoffs: childEvaluation.payoffs,
            chosen_edge_id: selectedEdge.id,
            alternative_edges: (outgoingByNode.get(candidateNode.id) ?? [])
              .filter((edge) => edge.id !== selectedEdge.id)
              .map((edge) => {
                const alternative = evaluateNode(edge.to)
                return {
                  edge_id: edge.id,
                  player_payoffs: alternative.payoffs,
                  payoff_difference: buildPayoffDifference(childEvaluation.payoffs, alternative.payoffs),
                }
              }),
          },
          warnings: [],
        })
      }

      if (weightedScore > bestScore) {
        bestScore = weightedScore
        bestAction = actionLabel
        for (const [candidateId, evaluation] of localEvaluations) {
          chosenByNode.set(candidateId, evaluation)
        }
      }
    }

    const bucket = new Map<string, NodeEvaluation>()
    for (const candidateId of nodeIds) {
      const evaluation = chosenByNode.get(candidateId) ?? {
        payoffs: {},
        chosenEdgeId: null,
        subgameValue: null,
        warnings: [],
      }
      memo.set(candidateId, evaluation)
      bucket.set(candidateId, evaluation)
    }
    infoSetMemo.set(informationSet.id, bucket)

    const current = bucket.get(node.id) ?? createFallbackEvaluation(`Node ${node.id} not found in information set ${informationSet.id}.`)
    if (!bestAction) {
      warnings.add(`Information set ${informationSet.id} has no shared actions.`)
    }
    return current
  }

  const evaluateNode = (nodeId: string): NodeEvaluation => {
    if (memo.has(nodeId)) {
      return memo.get(nodeId)!
    }

    const node = nodeById.get(nodeId)
    if (!node) {
      const fallback = createFallbackEvaluation(`Node ${nodeId} not found.`)
      memo.set(nodeId, fallback)
      return fallback
    }

    const outgoing = outgoingByNode.get(nodeId) ?? []
    if (outgoing.length === 0 || node.type === 'terminal') {
      return evaluateTerminalNode(node, nodeId)
    }

    const informationSet = node.information_set_id ? informationSetByNode.get(node.id) : null
    if (informationSet) {
      return evaluateInformationSet(node, informationSet, evaluateNode)
    }

    if (node.type === 'chance' || node.actor.kind === 'nature') {
      const evaluation = evaluateChanceNode(node, outgoing, evaluateNode)
      memo.set(nodeId, evaluation)
      return evaluation
    }

    const evaluation = evaluateDecisionNode(node, outgoing, evaluateNode)
    memo.set(nodeId, evaluation)
    return evaluation
  }

  evaluateNode(formalization.root_node_id)
  const optimalStrategies: Record<string, string> = {}
  const subgameValues: Record<string, SubgameValue> = {}
  for (const [nodeId, evaluation] of memo.entries()) {
    if (evaluation.chosenEdgeId) {
      optimalStrategies[nodeId] = evaluation.chosenEdgeId
    }
    if (evaluation.subgameValue) {
      subgameValues[nodeId] = evaluation.subgameValue
    }
  }

  const solutionPath: string[] = []
  let currentNodeId: string | null = formalization.root_node_id
  while (currentNodeId) {
    const edgeId: string | undefined = optimalStrategies[currentNodeId]
    if (!edgeId) {
      break
    }
    solutionPath.push(edgeId)
    const edge: GameEdge | undefined = edges.find((candidate) => candidate.id === edgeId)
    currentNodeId = edge?.to ?? null
  }

  return {
    ...result,
    meta: usesUniformBeliefs
      ? {
          ...result.meta,
          method_id: 'backward_induction_uniform_belief',
          limitations: [
            ...result.meta.limitations,
            'Assumes uniform beliefs at information sets — not equivalent to sequential equilibrium.',
          ],
        }
      : {
          ...result.meta,
          method_id: 'backward_induction_weighted_belief',
        },
    status: warnings.size > 0 ? 'partial' : 'success',
    warnings: [...gate.warnings, ...warnings],
    solution_path: solutionPath,
    subgame_values: subgameValues,
    optimal_strategies: optimalStrategies,
  }
}
