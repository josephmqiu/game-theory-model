import { useMemo } from 'react'

import type { ViewType } from '../store'
import { useAppStore } from '../store'

export function useKeyFindings() {
  const canonical = useAppStore((state) => state.canonical)

  return useMemo(() => {
    const findings: Array<{
      label: string
      count: number
      entity_type: string
      route: ViewType
    }> = [
      { label: 'Evidence', count: Object.keys(canonical.sources).length + Object.keys(canonical.claims).length, entity_type: 'source', route: 'evidence' },
      { label: 'Players', count: Object.keys(canonical.players).length, entity_type: 'player', route: 'players' },
      { label: 'Games', count: Object.keys(canonical.games).length, entity_type: 'game', route: 'game_map' },
      { label: 'Trust', count: Object.keys(canonical.trust_assessments).length, entity_type: 'trust_assessment', route: 'timeline' },
      { label: 'Scenarios', count: Object.keys(canonical.scenarios).length, entity_type: 'scenario', route: 'scenarios' },
    ]

    return findings.filter((finding) => finding.count > 0)
  }, [canonical])
}
