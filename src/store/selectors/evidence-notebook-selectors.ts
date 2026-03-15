import type { CanonicalStore, StaleMarker } from '../../types/canonical'
import { collectGameScope } from './game-scope'

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

export function selectEvidenceLadder(
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

  if (!canonical.games[gameId]) {
    return emptyLadder
  }
  const scope = collectGameScope(canonical, gameId)
  const scopeIsEmpty =
    scope.source.size === 0 &&
    scope.observation.size === 0 &&
    scope.claim.size === 0 &&
    scope.inference.size === 0 &&
    scope.contradiction.size === 0

  const includeAllEvidence = scopeIsEmpty && canonical.games[gameId]!.formalizations.length === 0

  const sources: EvidenceNotebookEntry[] = []
  const observations: EvidenceNotebookEntry[] = []
  const claims: EvidenceNotebookEntry[] = []
  const inferences: EvidenceNotebookEntry[] = []
  const assumptions: EvidenceNotebookEntry[] = []
  const contradictions: EvidenceNotebookEntry[] = []

  for (const source of Object.values(canonical.sources)) {
    if (!includeAllEvidence && !scope.source.has(source.id)) continue
    sources.push({
      id: source.id,
      type: 'source',
      title: source.title ?? source.url ?? source.id,
      isStale: hasStaleMarkers(source.stale_markers),
    })
  }

  for (const observation of Object.values(canonical.observations)) {
    if (!includeAllEvidence && !scope.observation.has(observation.id)) continue
    observations.push({
      id: observation.id,
      type: 'observation',
      title: observation.text,
      isStale: hasStaleMarkers(observation.stale_markers),
    })
  }

  for (const claim of Object.values(canonical.claims)) {
    if (!includeAllEvidence && !scope.claim.has(claim.id)) continue
    claims.push({
      id: claim.id,
      type: 'claim',
      title: claim.statement,
      confidence: claim.confidence,
      isStale: hasStaleMarkers(claim.stale_markers),
    })
  }

  for (const inference of Object.values(canonical.inferences)) {
    if (!includeAllEvidence && !scope.inference.has(inference.id)) continue
    inferences.push({
      id: inference.id,
      type: 'inference',
      title: inference.statement,
      confidence: inference.confidence,
      isStale: hasStaleMarkers(inference.stale_markers),
    })
  }

  for (const assumption of Object.values(canonical.assumptions)) {
    if (!includeAllEvidence && !scope.assumption.has(assumption.id)) continue
    assumptions.push({
      id: assumption.id,
      type: 'assumption',
      title: assumption.statement,
      confidence: assumption.confidence,
      isStale: hasStaleMarkers(assumption.stale_markers),
    })
  }

  for (const contradiction of Object.values(canonical.contradictions)) {
    if (!includeAllEvidence && !scope.contradiction.has(contradiction.id)) continue
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

export function selectDerivationChain(
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
