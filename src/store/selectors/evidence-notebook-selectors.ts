import type { CanonicalStore, StaleMarker } from '../../types/canonical'

export type EvidenceLadderType =
  | 'source'
  | 'observation'
  | 'claim'
  | 'inference'
  | 'assumption'
  | 'contradiction'

export const LADDER_ORDER: readonly EvidenceLadderType[] = [
  'source',
  'observation',
  'claim',
  'inference',
  'assumption',
  'contradiction',
] as const

export interface EvidenceNotebookEntry {
  id: string
  type: EvidenceLadderType
  title: string
  confidence?: number
  isStale: boolean
}

export interface EvidenceLadder {
  source: readonly EvidenceNotebookEntry[]
  observation: readonly EvidenceNotebookEntry[]
  claim: readonly EvidenceNotebookEntry[]
  inference: readonly EvidenceNotebookEntry[]
  assumption: readonly EvidenceNotebookEntry[]
  contradiction: readonly EvidenceNotebookEntry[]
}

export interface DerivationChainResult {
  upstream: readonly DerivationChainLink[]
  downstream: readonly DerivationChainLink[]
}

export interface DerivationChainLink {
  id: string
  relation: string
  entityId: string
}

function hasStaleMarkers(markers: readonly StaleMarker[] | undefined): boolean {
  return markers !== undefined && markers.length > 0
}

function isLinkedToGame(
  entityId: string,
  gamePlayerIds: ReadonlySet<string>,
  gameAssumptionIds: ReadonlySet<string>,
  canonical: CanonicalStore,
): boolean {
  // If this is a key_assumption of the game, it's linked
  if (gameAssumptionIds.has(entityId)) {
    return true
  }

  // Check claims referenced by game nodes
  for (const node of Object.values(canonical.nodes)) {
    if (node.claims?.includes(entityId)) return true
    if (node.inferences?.includes(entityId)) return true
    if (node.assumptions?.includes(entityId)) return true
  }

  // Check observations whose source is linked
  const observation = canonical.observations[entityId]
  if (observation) {
    // Observation is linked if its source is in the store (game-scoped is relaxed for now)
    return observation.source_id in canonical.sources
  }

  // Check if this is a source referenced by any observation in the store
  if (entityId in canonical.sources) {
    for (const obs of Object.values(canonical.observations)) {
      if (obs.source_id === entityId) {
        return true
      }
    }
  }

  // Check derivation edges for linkage
  for (const derivation of Object.values(canonical.derivations)) {
    if (derivation.from_ref === entityId || derivation.to_ref === entityId) {
      return true
    }
  }

  // Check contradictions referencing claims in the store
  const contradiction = canonical.contradictions[entityId]
  if (contradiction) {
    return (
      contradiction.left_ref in canonical.claims ||
      contradiction.right_ref in canonical.claims
    )
  }

  return false
}

export function useEvidenceLadder(
  canonical: CanonicalStore,
  gameId: string | null,
): EvidenceLadder {
  const emptyLadder: EvidenceLadder = {
    source: [],
    observation: [],
    claim: [],
    inference: [],
    assumption: [],
    contradiction: [],
  }

  if (!gameId) {
    return emptyLadder
  }

  const game = canonical.games[gameId]
  if (!game) {
    return emptyLadder
  }

  const gameAssumptionIds = new Set(game.key_assumptions)
  const gamePlayerIds = new Set(game.players)

  const sources: EvidenceNotebookEntry[] = []
  const observations: EvidenceNotebookEntry[] = []
  const claims: EvidenceNotebookEntry[] = []
  const inferences: EvidenceNotebookEntry[] = []
  const assumptions: EvidenceNotebookEntry[] = []
  const contradictions: EvidenceNotebookEntry[] = []

  for (const source of Object.values(canonical.sources)) {
    if (!isLinkedToGame(source.id, gamePlayerIds, gameAssumptionIds, canonical)) continue
    sources.push({
      id: source.id,
      type: 'source',
      title: source.title ?? source.url ?? source.id,
      isStale: hasStaleMarkers(source.stale_markers),
    })
  }

  for (const observation of Object.values(canonical.observations)) {
    if (!isLinkedToGame(observation.id, gamePlayerIds, gameAssumptionIds, canonical)) continue
    observations.push({
      id: observation.id,
      type: 'observation',
      title: observation.text,
      isStale: hasStaleMarkers(observation.stale_markers),
    })
  }

  for (const claim of Object.values(canonical.claims)) {
    if (!isLinkedToGame(claim.id, gamePlayerIds, gameAssumptionIds, canonical)) continue
    claims.push({
      id: claim.id,
      type: 'claim',
      title: claim.statement,
      confidence: claim.confidence,
      isStale: hasStaleMarkers(claim.stale_markers),
    })
  }

  for (const inference of Object.values(canonical.inferences)) {
    if (!isLinkedToGame(inference.id, gamePlayerIds, gameAssumptionIds, canonical)) continue
    inferences.push({
      id: inference.id,
      type: 'inference',
      title: inference.statement,
      confidence: inference.confidence,
      isStale: hasStaleMarkers(inference.stale_markers),
    })
  }

  for (const assumption of Object.values(canonical.assumptions)) {
    if (!isLinkedToGame(assumption.id, gamePlayerIds, gameAssumptionIds, canonical)) continue
    assumptions.push({
      id: assumption.id,
      type: 'assumption',
      title: assumption.statement,
      confidence: assumption.confidence,
      isStale: hasStaleMarkers(assumption.stale_markers),
    })
  }

  for (const contradiction of Object.values(canonical.contradictions)) {
    if (!isLinkedToGame(contradiction.id, gamePlayerIds, gameAssumptionIds, canonical)) continue
    contradictions.push({
      id: contradiction.id,
      type: 'contradiction',
      title: contradiction.description,
      isStale: hasStaleMarkers(contradiction.stale_markers),
    })
  }

  return {
    source: sources,
    observation: observations,
    claim: claims,
    inference: inferences,
    assumption: assumptions,
    contradiction: contradictions,
  }
}

export function useDerivationChain(
  canonical: CanonicalStore,
  entityId: string | null,
): DerivationChainResult {
  const empty: DerivationChainResult = { upstream: [], downstream: [] }

  if (!entityId) {
    return empty
  }

  const upstream: DerivationChainLink[] = []
  const downstream: DerivationChainLink[] = []

  for (const derivation of Object.values(canonical.derivations)) {
    if (derivation.to_ref === entityId) {
      upstream.push({
        id: derivation.id,
        relation: derivation.relation,
        entityId: derivation.from_ref,
      })
    }

    if (derivation.from_ref === entityId) {
      downstream.push({
        id: derivation.id,
        relation: derivation.relation,
        entityId: derivation.to_ref,
      })
    }
  }

  return { upstream, downstream }
}
