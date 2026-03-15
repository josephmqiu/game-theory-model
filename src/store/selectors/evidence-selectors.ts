import type { CanonicalStore } from '../../types/canonical'
import type { StaleMarker } from '../../types/canonical'

export type EvidenceTab = 'all' | 'sources' | 'claims' | 'assumptions'

export interface EvidenceEntry {
  id: string
  type: 'source' | 'claim' | 'assumption'
  title: string
  confidence?: number
  isStale: boolean
}

function hasStaleMarkers(markers: readonly StaleMarker[] | undefined): boolean {
  return markers !== undefined && markers.length > 0
}

export function selectEvidenceLibrary(
  canonical: CanonicalStore,
  tab: EvidenceTab = 'all',
): EvidenceEntry[] {
  const entries: EvidenceEntry[] = []

  if (tab === 'all' || tab === 'sources') {
    for (const source of Object.values(canonical.sources)) {
      entries.push({
        id: source.id,
        type: 'source',
        title: source.title ?? source.url ?? source.id,
        confidence: undefined,
        isStale: hasStaleMarkers(source.stale_markers),
      })
    }
  }

  if (tab === 'all' || tab === 'claims') {
    for (const claim of Object.values(canonical.claims)) {
      entries.push({
        id: claim.id,
        type: 'claim',
        title: claim.statement,
        confidence: claim.confidence,
        isStale: hasStaleMarkers(claim.stale_markers),
      })
    }
  }

  if (tab === 'all' || tab === 'assumptions') {
    for (const assumption of Object.values(canonical.assumptions)) {
      entries.push({
        id: assumption.id,
        type: 'assumption',
        title: assumption.statement,
        confidence: assumption.confidence,
        isStale: hasStaleMarkers(assumption.stale_markers),
      })
    }
  }

  return entries
}
