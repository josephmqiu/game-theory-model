export const entityTypes = [
  'game',
  'formalization',
  'player',
  'game_node',
  'game_edge',
  'source',
  'observation',
  'claim',
  'inference',
  'assumption',
  'contradiction',
  'derivation',
  'latent_factor',
  'cross_game_link',
  'scenario',
  'playbook',
] as const

export const semanticGameLabels = [
  'chicken',
  'prisoners_dilemma',
  'coordination',
  'attrition',
  'deterrence',
  'coercive_bargaining',
  'signaling',
  'hostage',
  'domestic_political',
  'coalition',
  'repeated_defection',
  'bargaining',
  'evolutionary',
  'custom',
] as const

export const canonicalGameTypes = [
  'chicken_brinkmanship',
  'prisoners_dilemma',
  'coordination',
  'war_of_attrition',
  'bargaining',
  'signaling',
  'bayesian_incomplete_info',
  'coalition_alliance',
  'domestic_political',
  'economic_chokepoint',
  'bertrand_competition',
  'hotelling_differentiation',
  'entry_deterrence',
  'network_effects_platform',
] as const

export type CanonicalGameType = (typeof canonicalGameTypes)[number]

export const playerRoles = [
  'primary',
  'involuntary',
  'background',
  'internal',
  'gatekeeper',
] as const

export const gameStatuses = ['active', 'paused', 'resolved', 'stale'] as const

export const actorKinds = ['player', 'nature', 'environment', 'coalition_proxy'] as const

export const playerKinds = [
  'state',
  'organization',
  'individual',
  'coalition',
  'market',
  'public',
] as const

export const gameNodeKinds = ['decision', 'chance', 'terminal'] as const

export const solverKinds = [
  'nash',
  'backward_induction',
  'expected_utility',
  'dominance',
  'bayesian_update',
  'cascade',
  'simulation',
  'bargaining',
  'evolutionary',
  'correlated_equilibrium',
  'credible_commitment',
  'game_classifier',
  'mechanism_design',
] as const

export const solverReadinessStates = ['ready', 'usable_with_warnings', 'not_ready'] as const

export type BaseEntity = import('zod').infer<typeof import('./schemas').baseEntitySchema>
export type EntityType = import('zod').infer<typeof import('./schemas').entityTypeSchema>
export type EntityRef = import('zod').infer<typeof import('./schemas').entityRefSchema>
export type StaleMarker = import('zod').infer<typeof import('./schemas').staleMarkerSchema>
export type SemanticGameLabel = import('zod').infer<typeof import('./schemas').semanticGameLabelSchema>
export type SolverKind = import('zod').infer<typeof import('./schemas').solverKindSchema>
export type SolverReadiness = import('zod').infer<typeof import('./schemas').solverReadinessSchema>
export type StrategicGame = import('zod').infer<typeof import('./schemas').strategicGameSchema>
export type Actor = import('zod').infer<typeof import('./schemas').actorSchema>
export type Player = import('zod').infer<typeof import('./schemas').playerSchema>
export type GameNode = import('zod').infer<typeof import('./schemas').gameNodeSchema>
export type GameEdge = import('zod').infer<typeof import('./schemas').gameEdgeSchema>

export type CanonicalStore = {
  games: Record<string, StrategicGame>
  formalizations: Record<string, import('./formalizations').Formalization>
  players: Record<string, Player>
  nodes: Record<string, GameNode>
  edges: Record<string, GameEdge>
  sources: Record<string, import('./evidence').Source>
  observations: Record<string, import('./evidence').Observation>
  claims: Record<string, import('./evidence').Claim>
  inferences: Record<string, import('./evidence').Inference>
  assumptions: Record<string, import('./evidence').Assumption>
  contradictions: Record<string, import('./evidence').Contradiction>
  derivations: Record<string, import('./evidence').DerivationEdge>
  latent_factors: Record<string, import('./evidence').LatentFactor>
  cross_game_links: Record<string, import('./evidence').CrossGameLink>
  scenarios: Record<string, import('./evidence').Scenario>
  playbooks: Record<string, import('./evidence').Playbook>
}

export const STORE_KEY = {
  game: 'games',
  formalization: 'formalizations',
  player: 'players',
  game_node: 'nodes',
  game_edge: 'edges',
  source: 'sources',
  observation: 'observations',
  claim: 'claims',
  inference: 'inferences',
  assumption: 'assumptions',
  contradiction: 'contradictions',
  derivation: 'derivations',
  latent_factor: 'latent_factors',
  cross_game_link: 'cross_game_links',
  scenario: 'scenarios',
  playbook: 'playbooks',
} as const satisfies Record<EntityType, keyof CanonicalStore>

export function refKey(ref: EntityRef): string {
  return `${ref.type}:${ref.id}`
}

export function createEntityRef(type: EntityType, id: string): EntityRef {
  return Object.freeze({ type, id })
}

export function emptyCanonicalStore(): CanonicalStore {
  return {
    games: {},
    formalizations: {},
    players: {},
    nodes: {},
    edges: {},
    sources: {},
    observations: {},
    claims: {},
    inferences: {},
    assumptions: {},
    contradictions: {},
    derivations: {},
    latent_factors: {},
    cross_game_links: {},
    scenarios: {},
    playbooks: {},
  }
}
