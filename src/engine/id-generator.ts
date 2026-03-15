import type { EntityType } from '../types/canonical'

const ENTITY_ID_PREFIXES = {
  game: 'game',
  formalization: 'formalization',
  player: 'player',
  game_node: 'game_node',
  game_edge: 'game_edge',
  source: 'source',
  observation: 'observation',
  claim: 'claim',
  inference: 'inference',
  assumption: 'assumption',
  contradiction: 'contradiction',
  derivation: 'derivation',
  latent_factor: 'latent_factor',
  cross_game_link: 'cross_game_link',
  scenario: 'scenario',
  playbook: 'playbook',
  escalation_ladder: 'escalation_ladder',
  trust_assessment: 'trust_assessment',
  eliminated_outcome: 'eliminated_outcome',
  signal_classification: 'signal_classification',
  repeated_game_pattern: 'repeated_game_pattern',
  revalidation_event: 'revalidation_event',
  dynamic_inconsistency_risk: 'dynamic_inconsistency_risk',
  cross_game_constraint_table: 'cross_game_constraint_table',
  central_thesis: 'central_thesis',
  tail_risk: 'tail_risk',
} as const satisfies Record<EntityType, string>

const ENTITY_TYPE_ENTRIES = Object.entries(ENTITY_ID_PREFIXES).sort(
  (left, right) => right[1].length - left[1].length,
) as Array<[EntityType, string]>

export function generateEntityId(type: EntityType): string {
  return `${ENTITY_ID_PREFIXES[type]}_${crypto.randomUUID()}`
}

export function inferEntityTypeFromId(id: string): EntityType | null {
  for (const [entityType, prefix] of ENTITY_TYPE_ENTRIES) {
    if (id.startsWith(`${prefix}_`)) {
      return entityType
    }
  }

  return null
}

