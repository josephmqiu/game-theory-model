import type { CanonicalStore, EntityRef, EntityType, StaleMarker } from '../types'
import { STORE_KEY, createEntityRef, refKey } from '../types/canonical'

import { collectDeclaredReferences, allowsTargetType } from './reference-utils'
import { listEntities } from './store-utils'

export interface RefDeclaration {
  field: string
  target: EntityType | EntityType[]
  cardinality: 'one' | 'many'
  required: boolean
  on_delete:
    | 'block'
    | 'remove_ref'
    | 'remove_ref_or_stale_if_empty'
    | 'cascade_delete'
    | 'mark_stale'
}

export type IntegrityAction =
  | { kind: 'remove_ref'; entity: EntityRef; field: string; ref_id: string }
  | { kind: 'mark_stale'; entity: EntityRef; reason: string; caused_by: EntityRef }
  | { kind: 'cascade_delete'; entity: EntityRef }
  | { kind: 'block'; reason: string }

export interface ImpactReport {
  target: EntityRef
  direct_dependents: EntityRef[]
  transitive_dependents: EntityRef[]
  proposed_actions: IntegrityAction[]
  severity: 'safe' | 'warning' | 'destructive'
}

export const REFERENCE_SCHEMA: Record<EntityType, RefDeclaration[]> = {
  game: [
    { field: 'players', target: 'player', cardinality: 'many', required: true, on_delete: 'remove_ref_or_stale_if_empty' },
    { field: 'formalizations', target: 'formalization', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'coupling_links', target: 'cross_game_link', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'key_assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
  ],
  formalization: [
    { field: 'game_id', target: 'game', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'root_node_id', target: 'game_node', cardinality: 'one', required: false, on_delete: 'cascade_delete' },
    { field: 'stage_formalization_id', target: 'formalization', cardinality: 'one', required: false, on_delete: 'cascade_delete' },
    { field: 'agenda_setters', target: 'player', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'parties', target: 'player', cardinality: 'many', required: true, on_delete: 'remove_ref_or_stale_if_empty' },
    { field: 'first_mover', target: 'player', cardinality: 'one', required: false, on_delete: 'remove_ref' },
    { field: 'outside_options.*.source_claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'outside_options.*.assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'discount_factors.*.source_claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'discount_factors.*.assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'commitment_power.*.source_claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'commitment_power.*.assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'surplus.source_claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'surplus.assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'discount_factors.*.delta.source_claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'discount_factors.*.delta.assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'discount_factors.*.beta.source_claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'discount_factors.*.beta.assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
  ],
  player: [
    { field: 'risk_profile.source_claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'risk_profile.assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'reservation_utility.source_claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'reservation_utility.assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'audience_costs.source_claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'audience_costs.assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
  ],
  game_node: [
    { field: 'formalization_id', target: 'formalization', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'inferences', target: 'inference', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'terminal_payoffs.*.source_claims', target: 'claim', cardinality: 'many', required: true, on_delete: 'remove_ref_or_stale_if_empty' },
    { field: 'terminal_payoffs.*.assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'terminal_payoffs.*.latent_factors', target: 'latent_factor', cardinality: 'many', required: false, on_delete: 'remove_ref' },
  ],
  game_edge: [
    { field: 'formalization_id', target: 'formalization', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'from', target: 'game_node', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'to', target: 'game_node', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'triggers_cross_game_links', target: 'cross_game_link', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'choice_forecast.conditions.*.ref_id', target: ['assumption', 'scenario', 'game_edge'], cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'choice_forecast.source_claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'choice_forecast.assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'chance_estimate.source_claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'chance_estimate.assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'payoff_delta.*.source_claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'payoff_delta.*.assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'payoff_delta.*.latent_factors', target: 'latent_factor', cardinality: 'many', required: false, on_delete: 'remove_ref' },
  ],
  source: [],
  observation: [
    { field: 'source_id', target: 'source', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
  ],
  claim: [
    { field: 'based_on', target: 'observation', cardinality: 'many', required: true, on_delete: 'remove_ref_or_stale_if_empty' },
    { field: 'contested_by', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
  ],
  inference: [
    { field: 'derived_from', target: 'claim', cardinality: 'many', required: true, on_delete: 'remove_ref_or_stale_if_empty' },
  ],
  assumption: [
    { field: 'supported_by', target: ['claim', 'inference'], cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'contradicted_by', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
  ],
  contradiction: [
    { field: 'left_ref', target: 'claim', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'right_ref', target: 'claim', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
  ],
  derivation: [
    { field: 'from_ref', target: ['source', 'observation', 'claim', 'inference', 'assumption'], cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'to_ref', target: ['claim', 'inference', 'assumption', 'game_node', 'game_edge'], cardinality: 'one', required: true, on_delete: 'cascade_delete' },
  ],
  latent_factor: [
    { field: 'affects', target: ['assumption', 'game_node', 'game_edge'], cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'source_claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
  ],
  cross_game_link: [
    { field: 'source_game_id', target: 'game', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'target_game_id', target: 'game', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'trigger_ref', target: ['game_edge', 'game_node'], cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'target_ref', target: ['formalization', 'game_node', 'player'], cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'conditions.*.ref_id', target: ['assumption', 'scenario', 'game_edge'], cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'source_claims', target: 'claim', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'remove_ref' },
  ],
  scenario: [
    { field: 'formalization_id', target: 'formalization', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'path', target: 'game_edge', cardinality: 'many', required: true, on_delete: 'mark_stale' },
    { field: 'key_assumptions', target: 'assumption', cardinality: 'many', required: false, on_delete: 'mark_stale' },
    { field: 'key_latent_factors', target: 'latent_factor', cardinality: 'many', required: false, on_delete: 'remove_ref' },
    { field: 'invalidators', target: ['claim', 'inference', 'assumption'], cardinality: 'many', required: false, on_delete: 'remove_ref' },
  ],
  playbook: [
    { field: 'formalization_id', target: 'formalization', cardinality: 'one', required: true, on_delete: 'cascade_delete' },
    { field: 'derived_from_scenario', target: 'scenario', cardinality: 'one', required: false, on_delete: 'remove_ref' },
  ],
}

export interface IntegrityValidationResult {
  errors: string[]
  warnings: string[]
}

function hasMatchingStaleCause(entity: unknown, target: EntityRef): boolean {
  const markers = (entity as { stale_markers?: ReadonlyArray<StaleMarker> }).stale_markers
  if (!Array.isArray(markers)) {
    return false
  }

  return markers.some((marker) => refKey(marker.caused_by) === refKey(target))
}

export function validateStoreInvariants(store: CanonicalStore): IntegrityValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  for (const { ref, entity } of listEntities(store)) {
    for (const reference of collectDeclaredReferences(
      ref.type,
      ref.id,
      entity,
      REFERENCE_SCHEMA[ref.type],
    )) {
      if (!allowsTargetType(reference.declaration, reference.target_type)) {
        errors.push(
          `Invalid reference type at ${refKey(ref)}.${reference.field}: ${reference.ref_id}`,
        )
        continue
      }

      const target = createEntityRef(reference.target_type, reference.ref_id)
      const targetRecord = store[STORE_KEY[reference.target_type]]

      if (!(target.id in targetRecord)) {
        if (reference.declaration.on_delete === 'mark_stale' && hasMatchingStaleCause(entity, target)) {
          continue
        }

        errors.push(
          `Dangling reference at ${refKey(ref)}.${reference.field}: ${reference.ref_id}`,
        )
      }
    }
  }

  const derivationAdjacency = new Map<string, string[]>()
  for (const derivation of Object.values(store.derivations)) {
    const neighbors = derivationAdjacency.get(derivation.from_ref) ?? []
    neighbors.push(derivation.to_ref)
    derivationAdjacency.set(derivation.from_ref, neighbors)
  }

  const visitState = new Map<string, 'visiting' | 'visited'>()
  const visit = (nodeId: string): boolean => {
    const state = visitState.get(nodeId)
    if (state === 'visiting') {
      return true
    }
    if (state === 'visited') {
      return false
    }

    visitState.set(nodeId, 'visiting')
    for (const neighbor of derivationAdjacency.get(nodeId) ?? []) {
      if (visit(neighbor)) {
        return true
      }
    }
    visitState.set(nodeId, 'visited')
    return false
  }

  for (const nodeId of derivationAdjacency.keys()) {
    if (visit(nodeId)) {
      errors.push('Derivation edges must form a DAG.')
      break
    }
  }

  for (const node of Object.values(store.nodes)) {
    if (node.actor.kind !== 'nature') {
      continue
    }

    const outgoing = Object.values(store.edges).filter((edge) => edge.from === node.id)
    if (outgoing.length === 0) {
      continue
    }

    let total = 0
    let hasMissingChanceEstimate = false
    for (const edge of outgoing) {
      if (typeof edge.chance_estimate?.value !== 'number') {
        hasMissingChanceEstimate = true
        break
      }
      total += edge.chance_estimate.value
    }

    if (hasMissingChanceEstimate || Math.abs(total - 1) > 0.001) {
      errors.push(`Outgoing chance estimates for node ${node.id} must sum to 1.0 ± 0.001.`)
    }
  }

  for (const formalization of Object.values(store.formalizations)) {
    if (formalization.kind !== 'extensive_form') {
      continue
    }

    for (const informationSet of formalization.information_sets) {
      const edgeCounts = informationSet.node_ids.map(
        (nodeId) => Object.values(store.edges).filter((edge) => edge.from === nodeId).length,
      )
      if (new Set(edgeCounts).size > 1) {
        errors.push(
          `Nodes in information set ${informationSet.id} must have the same number of outgoing edges.`,
        )
      }
    }
  }

  for (const scenario of Object.values(store.scenarios)) {
    if (scenario.probability_model === 'independent') {
      warnings.push(
        `Scenario ${scenario.id}: Independent probability multiplication typically overestimates joint probabilities for real-world events. Consider dependency-aware mode.`,
      )
    }
  }

  return { errors, warnings }
}
