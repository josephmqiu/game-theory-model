import type { CanonicalStore, EntityRef, EntityType } from '../../types/canonical'

type ScopeSets = Record<EntityType, Set<string>>

function createScopeSets(): ScopeSets {
  return {
    game: new Set(),
    formalization: new Set(),
    player: new Set(),
    game_node: new Set(),
    game_edge: new Set(),
    source: new Set(),
    observation: new Set(),
    claim: new Set(),
    inference: new Set(),
    assumption: new Set(),
    contradiction: new Set(),
    derivation: new Set(),
    latent_factor: new Set(),
    cross_game_link: new Set(),
    scenario: new Set(),
    playbook: new Set(),
    escalation_ladder: new Set(),
    trust_assessment: new Set(),
    eliminated_outcome: new Set(),
    signal_classification: new Set(),
    repeated_game_pattern: new Set(),
    revalidation_event: new Set(),
    dynamic_inconsistency_risk: new Set(),
    cross_game_constraint_table: new Set(),
    central_thesis: new Set(),
    tail_risk: new Set(),
  }
}

function addIfPresent(set: Set<string>, id: string | undefined): void {
  if (id) {
    set.add(id)
  }
}

function evidenceIds(scope: ScopeSets): Set<string> {
  return new Set([
    ...scope.source,
    ...scope.observation,
    ...scope.claim,
    ...scope.inference,
    ...scope.assumption,
    ...scope.contradiction,
  ])
}

export function collectGameScope(canonical: CanonicalStore, gameId: string | null): ScopeSets {
  const scope = createScopeSets()
  if (!gameId) {
    return scope
  }

  const game = canonical.games[gameId]
  if (!game) {
    return scope
  }

  scope.game.add(gameId)
  game.players.forEach((id) => scope.player.add(id))
  game.formalizations.forEach((id) => scope.formalization.add(id))
  game.key_assumptions.forEach((id) => scope.assumption.add(id))
  game.coupling_links.forEach((id) => scope.cross_game_link.add(id))

  Object.values(canonical.cross_game_links).forEach((link) => {
    if (link.source_game_id === gameId || link.target_game_id === gameId) {
      scope.cross_game_link.add(link.id)
      addIfPresent(scope.game_edge, link.trigger_ref)
      addIfPresent(scope.formalization, link.target_ref)
      addIfPresent(scope.player, link.target_player_id)
      link.source_claims?.forEach((id) => scope.claim.add(id))
      link.assumptions?.forEach((id) => scope.assumption.add(id))
    }
  })

  Object.values(canonical.formalizations).forEach((formalization) => {
    if (formalization.game_id === gameId || scope.formalization.has(formalization.id)) {
      scope.formalization.add(formalization.id)
      formalization.assumptions.forEach((id) => scope.assumption.add(id))
    }
  })

  Object.values(canonical.nodes).forEach((node) => {
    if (scope.formalization.has(node.formalization_id)) {
      scope.game_node.add(node.id)
      if (node.actor.kind === 'player') {
        scope.player.add(node.actor.player_id)
      }
      node.claims?.forEach((id) => scope.claim.add(id))
      node.inferences?.forEach((id) => scope.inference.add(id))
      node.assumptions?.forEach((id) => scope.assumption.add(id))
    }
  })

  Object.values(canonical.edges).forEach((edge) => {
    if (scope.formalization.has(edge.formalization_id)) {
      scope.game_edge.add(edge.id)
      edge.choice_forecast?.source_claims.forEach((id) => scope.claim.add(id))
      edge.choice_forecast?.assumptions.forEach((id) => scope.assumption.add(id))
      edge.assumptions?.forEach((id) => scope.assumption.add(id))
    }
  })

  Object.values(canonical.scenarios).forEach((scenario) => {
    if (scope.formalization.has(scenario.formalization_id)) {
      scope.scenario.add(scenario.id)
      scenario.key_assumptions.forEach((id) => scope.assumption.add(id))
      scenario.path.forEach((edgeId) => scope.game_edge.add(edgeId))
    }
  })

  Object.values(canonical.playbooks).forEach((playbook) => {
    if (scope.formalization.has(playbook.formalization_id)) {
      scope.playbook.add(playbook.id)
    }
  })

  let changed = true
  while (changed) {
    changed = false

    Object.values(canonical.claims).forEach((claim) => {
      if (!scope.claim.has(claim.id)) return
      claim.based_on.forEach((observationId) => {
        if (!scope.observation.has(observationId)) {
          scope.observation.add(observationId)
          changed = true
        }
      })
    })

    Object.values(canonical.observations).forEach((observation) => {
      if (!scope.observation.has(observation.id)) return
      if (!scope.source.has(observation.source_id)) {
        scope.source.add(observation.source_id)
        changed = true
      }
    })

    Object.values(canonical.inferences).forEach((inference) => {
      if (!scope.inference.has(inference.id)) return
      inference.derived_from.forEach((refId) => {
        if (refId in canonical.claims && !scope.claim.has(refId)) {
          scope.claim.add(refId)
          changed = true
        }
        if (refId in canonical.inferences && !scope.inference.has(refId)) {
          scope.inference.add(refId)
          changed = true
        }
      })
    })

    Object.values(canonical.assumptions).forEach((assumption) => {
      if (!scope.assumption.has(assumption.id)) return
      assumption.supported_by?.forEach((claimId) => {
        if (!scope.claim.has(claimId)) {
          scope.claim.add(claimId)
          changed = true
        }
      })
    })

    Object.values(canonical.contradictions).forEach((contradiction) => {
      const linked =
        scope.claim.has(contradiction.left_ref) ||
        scope.claim.has(contradiction.right_ref) ||
        scope.inference.has(contradiction.left_ref) ||
        scope.inference.has(contradiction.right_ref)

      if (linked && !scope.contradiction.has(contradiction.id)) {
        scope.contradiction.add(contradiction.id)
        changed = true
      }
    })

    const scopedEvidence = evidenceIds(scope)
    Object.values(canonical.derivations).forEach((derivation) => {
      const touchesScope =
        scopedEvidence.has(derivation.from_ref) ||
        scopedEvidence.has(derivation.to_ref)

      if (!touchesScope) return

      if (!scope.derivation.has(derivation.id)) {
        scope.derivation.add(derivation.id)
        changed = true
      }

      if (derivation.from_ref in canonical.claims && !scope.claim.has(derivation.from_ref)) {
        scope.claim.add(derivation.from_ref)
        changed = true
      }
      if (derivation.to_ref in canonical.claims && !scope.claim.has(derivation.to_ref)) {
        scope.claim.add(derivation.to_ref)
        changed = true
      }
      if (derivation.from_ref in canonical.inferences && !scope.inference.has(derivation.from_ref)) {
        scope.inference.add(derivation.from_ref)
        changed = true
      }
      if (derivation.to_ref in canonical.inferences && !scope.inference.has(derivation.to_ref)) {
        scope.inference.add(derivation.to_ref)
        changed = true
      }
      if (derivation.from_ref in canonical.assumptions && !scope.assumption.has(derivation.from_ref)) {
        scope.assumption.add(derivation.from_ref)
        changed = true
      }
      if (derivation.to_ref in canonical.assumptions && !scope.assumption.has(derivation.to_ref)) {
        scope.assumption.add(derivation.to_ref)
        changed = true
      }
      if (derivation.from_ref in canonical.observations && !scope.observation.has(derivation.from_ref)) {
        scope.observation.add(derivation.from_ref)
        changed = true
      }
      if (derivation.to_ref in canonical.observations && !scope.observation.has(derivation.to_ref)) {
        scope.observation.add(derivation.to_ref)
        changed = true
      }
      if (derivation.from_ref in canonical.sources && !scope.source.has(derivation.from_ref)) {
        scope.source.add(derivation.from_ref)
        changed = true
      }
      if (derivation.to_ref in canonical.sources && !scope.source.has(derivation.to_ref)) {
        scope.source.add(derivation.to_ref)
        changed = true
      }
    })
  }

  Object.values(canonical.latent_factors).forEach((factor) => {
    const touchesNodes = factor.affects.some((nodeId) => scope.game_node.has(nodeId))
    const touchesClaims = factor.source_claims?.some((claimId) => scope.claim.has(claimId)) ?? false
    if (touchesNodes || touchesClaims) {
      scope.latent_factor.add(factor.id)
      factor.source_claims?.forEach((claimId) => scope.claim.add(claimId))
    }
  })

  return scope
}

export function entityBelongsToGame(
  canonical: CanonicalStore,
  gameId: string | null,
  ref: EntityRef | null,
): boolean {
  if (!ref || !gameId) {
    return false
  }

  const scope = collectGameScope(canonical, gameId)
  return scope[ref.type].has(ref.id)
}
