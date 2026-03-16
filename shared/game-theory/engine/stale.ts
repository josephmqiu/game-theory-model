import type { CanonicalStore, EntityRef, StaleMarker } from '../types'
import { refKey } from '../types/canonical'

import { REFERENCE_SCHEMA } from './integrity'
import type { InverseIndex } from './inverse-index'
import { collectDeclaredReferences } from './reference-utils'
import { getEntity, setEntity } from './store-utils'

const STALE_PROPAGATION_FIELD_KEYS = new Set([
  'observation.source_id',
  'claim.based_on',
  'inference.derived_from',
  'assumption.supported_by',
  'assumption.contradicted_by',
  'game.key_assumptions',
  'formalization.assumptions',
  'formalization.outside_options.*.source_claims',
  'formalization.outside_options.*.assumptions',
  'formalization.discount_factors.*.source_claims',
  'formalization.discount_factors.*.assumptions',
  'formalization.commitment_power.*.source_claims',
  'formalization.commitment_power.*.assumptions',
  'formalization.surplus.source_claims',
  'formalization.surplus.assumptions',
  'formalization.discount_factors.*.delta.source_claims',
  'formalization.discount_factors.*.delta.assumptions',
  'formalization.discount_factors.*.beta.source_claims',
  'formalization.discount_factors.*.beta.assumptions',
  'player.risk_profile.source_claims',
  'player.risk_profile.assumptions',
  'player.reservation_utility.source_claims',
  'player.reservation_utility.assumptions',
  'player.audience_costs.source_claims',
  'player.audience_costs.assumptions',
  'game_node.claims',
  'game_node.inferences',
  'game_node.assumptions',
  'game_node.terminal_payoffs.*.source_claims',
  'game_node.terminal_payoffs.*.assumptions',
  'game_edge.assumptions',
  'game_edge.choice_forecast.conditions.*.ref_id',
  'game_edge.choice_forecast.source_claims',
  'game_edge.choice_forecast.assumptions',
  'game_edge.chance_estimate.source_claims',
  'game_edge.chance_estimate.assumptions',
  'game_edge.payoff_delta.*.source_claims',
  'game_edge.payoff_delta.*.assumptions',
  'derivation.from_ref',
  'derivation.to_ref',
  'latent_factor.source_claims',
  'latent_factor.assumptions',
  'scenario.path',
  'scenario.key_assumptions',
  'scenario.key_latent_factors',
  'scenario.invalidators',
  'playbook.derived_from_scenario',
  'cross_game_link.conditions.*.ref_id',
  'cross_game_link.source_claims',
  'cross_game_link.assumptions',
  'escalation_ladder.game_id',
  'trust_assessment.assessor_player_id',
  'trust_assessment.target_player_id',
  'trust_assessment.evidence_refs',
  'trust_assessment.driving_patterns',
  'signal_classification.player_id',
  'signal_classification.evidence_refs',
  'signal_classification.game_refs',
  'repeated_game_pattern.game_id',
  'dynamic_inconsistency_risk.player_id',
  'dynamic_inconsistency_risk.evidence_refs',
  'dynamic_inconsistency_risk.affected_games',
  'cross_game_constraint_table.games',
  'cross_game_constraint_table.trapped_players',
  'eliminated_outcome.evidence_refs',
  'eliminated_outcome.related_scenarios',
  'tail_risk.related_scenarios',
  'tail_risk.evidence_refs',
  'central_thesis.evidence_refs',
  'central_thesis.assumption_refs',
  'central_thesis.scenario_refs',
])

function canPropagateFromReference(holder: EntityRef, entity: unknown, target: EntityRef): boolean {
  return collectDeclaredReferences(
    holder.type,
    holder.id,
    entity,
    REFERENCE_SCHEMA[holder.type],
  ).some(
    (reference) =>
      reference.target_type === target.type &&
      reference.ref_id === target.id &&
      STALE_PROPAGATION_FIELD_KEYS.has(`${holder.type}.${reference.field}`),
  )
}

function getPropagationDependents(
  store: CanonicalStore,
  index: InverseIndex,
  target: EntityRef,
): EntityRef[] {
  return (index[refKey(target)] ?? []).filter((dependent) => {
    const entity = getEntity(store, dependent)
    return entity ? canPropagateFromReference(dependent, entity, target) : false
  })
}

function withStaleMarker(
  entity: { stale_markers?: ReadonlyArray<StaleMarker> },
  marker: StaleMarker,
): typeof entity {
  const existing = entity.stale_markers ?? []
  const duplicate = existing.some((candidate) => refKey(candidate.caused_by) === refKey(marker.caused_by))
  if (duplicate) {
    return entity
  }

  return {
    ...entity,
    stale_markers: [...existing, marker],
  }
}

function withoutCause(
  entity: { stale_markers?: ReadonlyArray<StaleMarker> },
  root: EntityRef,
): typeof entity {
  const nextMarkers = (entity.stale_markers ?? []).filter(
    (marker) => refKey(marker.caused_by) !== refKey(root),
  )

  if (nextMarkers.length === 0) {
    const { stale_markers: _staleMarkers, ...rest } = entity
    return rest
  }

  return {
    ...entity,
    stale_markers: nextMarkers,
  }
}

export function propagateStale(
  store: CanonicalStore,
  index: InverseIndex,
  target: EntityRef,
  reason: string,
  cause: EntityRef = target,
): { store: CanonicalStore; affected: EntityRef[] } {
  const affected: EntityRef[] = []
  const visited = new Set<string>()
  const queue: EntityRef[] = [target]
  let nextStore = store
  const rootMarker: StaleMarker = {
    reason,
    stale_since: new Date().toISOString(),
    caused_by: cause,
  }

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) {
      continue
    }

    const currentKey = refKey(current)
    if (visited.has(currentKey)) {
      continue
    }
    visited.add(currentKey)

    const entity = getEntity(nextStore, current)
    if (!entity) {
      continue
    }

    const marker =
      currentKey === refKey(target)
        ? rootMarker
        : {
            reason: `Dependency ${cause.type}:${cause.id} is stale`,
            stale_since: rootMarker.stale_since,
            caused_by: cause,
          }

    const updated = withStaleMarker(entity, marker)
    if (updated !== entity) {
      nextStore = setEntity(nextStore, current.type, updated as never)
      affected.push(current)
    }

    for (const dependent of getPropagationDependents(nextStore, index, current)) {
      queue.push(dependent)
    }
  }

  return { store: nextStore, affected }
}

export function clearStale(
  store: CanonicalStore,
  index: InverseIndex,
  target: EntityRef,
  cause: EntityRef = target,
): { store: CanonicalStore; cleared: EntityRef[] } {
  const cleared: EntityRef[] = []
  const queue: EntityRef[] = [target]
  const visited = new Set<string>()
  let nextStore = store

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) {
      continue
    }

    const currentKey = refKey(current)
    if (visited.has(currentKey)) {
      continue
    }
    visited.add(currentKey)

    const entity = getEntity(nextStore, current)
    if (!entity) {
      continue
    }

    const beforeCount = entity.stale_markers?.length ?? 0
    const updated = withoutCause(entity, cause)
    const afterCount = updated.stale_markers?.length ?? 0
    if (beforeCount !== afterCount) {
      nextStore = setEntity(nextStore, current.type, updated as never)
      cleared.push(current)
    }

    for (const dependent of getPropagationDependents(nextStore, index, current)) {
      queue.push(dependent)
    }
  }

  return { store: nextStore, cleared }
}
