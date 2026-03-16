import type { CrossGameLink } from '../types/evidence'

export interface NormalizedCrossGameEffect {
  source_game_id: string
  target_game_id: string
  trigger_ref: string
  effect_type: CrossGameLink['effect_type']
  target_ref: string
  target_player_id?: string
  rationale: string
  priority: CrossGameLink['priority']
  mode_override?: CrossGameLink['mode_override']
}

export function normalizeCrossGameEffect(
  input: Omit<NormalizedCrossGameEffect, 'priority'> & {
    priority?: CrossGameLink['priority']
  },
): NormalizedCrossGameEffect {
  return {
    ...input,
    priority: input.priority ?? 'normal',
  }
}
