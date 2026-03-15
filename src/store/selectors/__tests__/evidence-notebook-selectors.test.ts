import { describe, it, expect } from 'vitest'

import {
  useEvidenceLadder,
  useDerivationChain,
  LADDER_ORDER,
} from '../evidence-notebook-selectors'
import { emptyCanonicalStore } from '../../../types/canonical'
import type { CanonicalStore } from '../../../types/canonical'

function makeTestStore(): CanonicalStore {
  const store = emptyCanonicalStore()

  store.games['g1'] = {
    id: 'g1',
    name: 'Test Game',
    description: 'A game for testing',
    semantic_labels: ['prisoners_dilemma'],
    players: ['p1', 'p2'],
    status: 'active',
    formalizations: [],
    coupling_links: [],
    key_assumptions: ['a1'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }

  store.players['p1'] = {
    id: 'p1',
    name: 'Alice',
    type: 'individual',
    objectives: [],
    constraints: [],
  }

  store.players['p2'] = {
    id: 'p2',
    name: 'Bob',
    type: 'individual',
    objectives: [],
    constraints: [],
  }

  store.sources['s1'] = {
    id: 's1',
    kind: 'web',
    url: 'https://example.com',
    title: 'Example Source',
    captured_at: '2026-01-01T00:00:00Z',
  }

  store.observations['obs1'] = {
    id: 'obs1',
    source_id: 's1',
    text: 'Observed behavior X',
    captured_at: '2026-01-01T00:00:00Z',
  }

  store.claims['c1'] = {
    id: 'c1',
    statement: 'Players prefer cooperation',
    based_on: ['obs1'],
    confidence: 0.8,
  }

  store.claims['c2'] = {
    id: 'c2',
    statement: 'Defection is dominant',
    based_on: ['obs1'],
    confidence: 0.6,
  }

  store.inferences['inf1'] = {
    id: 'inf1',
    statement: 'Equilibrium is mutual defection',
    derived_from: ['c2'],
    confidence: 0.7,
    rationale: 'Standard PD reasoning',
  }

  store.assumptions['a1'] = {
    id: 'a1',
    statement: 'Players are rational',
    type: 'behavioral',
    sensitivity: 'high',
    confidence: 0.9,
  }

  store.contradictions['con1'] = {
    id: 'con1',
    left_ref: 'c1',
    right_ref: 'c2',
    description: 'Cooperation vs defection dominance',
    resolution_status: 'open',
  }

  store.derivations['d1'] = {
    id: 'd1',
    from_ref: 'obs1',
    to_ref: 'c1',
    relation: 'supports',
  }

  store.derivations['d2'] = {
    id: 'd2',
    from_ref: 'c2',
    to_ref: 'inf1',
    relation: 'infers',
  }

  return store
}

describe('useEvidenceLadder', () => {
  it('returns empty ladder when gameId is null', () => {
    const store = makeTestStore()
    const result = useEvidenceLadder(store, null)

    for (const type of LADDER_ORDER) {
      expect(result[type]).toEqual([])
    }
  })

  it('returns empty ladder when game is not found', () => {
    const store = makeTestStore()
    const result = useEvidenceLadder(store, 'nonexistent')

    for (const type of LADDER_ORDER) {
      expect(result[type]).toEqual([])
    }
  })

  it('groups evidence entities in ladder order', () => {
    const store = makeTestStore()
    const result = useEvidenceLadder(store, 'g1')

    expect(result.source).toHaveLength(1)
    expect(result.source[0]!.title).toBe('Example Source')
    expect(result.source[0]!.type).toBe('source')

    expect(result.observation).toHaveLength(1)
    expect(result.observation[0]!.title).toBe('Observed behavior X')

    expect(result.claim).toHaveLength(2)
    expect(result.inference).toHaveLength(1)
    expect(result.assumption).toHaveLength(1)
    expect(result.contradiction).toHaveLength(1)
  })

  it('includes confidence for claims, inferences, and assumptions', () => {
    const store = makeTestStore()
    const result = useEvidenceLadder(store, 'g1')

    expect(result.claim[0]!.confidence).toBe(0.8)
    expect(result.inference[0]!.confidence).toBe(0.7)
    expect(result.assumption[0]!.confidence).toBe(0.9)
    expect(result.source[0]!.confidence).toBeUndefined()
  })

  it('marks stale entities correctly', () => {
    const store = makeTestStore()
    store.claims['c1'] = {
      ...store.claims['c1']!,
      stale_markers: [
        {
          reason: 'Source updated',
          stale_since: '2026-01-02T00:00:00Z',
          caused_by: { type: 'source', id: 's1' },
        },
      ],
    }

    const result = useEvidenceLadder(store, 'g1')

    const staleClaim = result.claim.find((c) => c.id === 'c1')
    expect(staleClaim!.isStale).toBe(true)

    const freshClaim = result.claim.find((c) => c.id === 'c2')
    expect(freshClaim!.isStale).toBe(false)
  })

  it('uses source url as fallback title', () => {
    const store = makeTestStore()
    store.sources['s2'] = {
      id: 's2',
      kind: 'web',
      url: 'https://fallback.com',
      captured_at: '2026-01-01T00:00:00Z',
    }
    // Link s2 to the game via an observation
    store.observations['obs2'] = {
      id: 'obs2',
      source_id: 's2',
      text: 'Fallback observation',
      captured_at: '2026-01-01T00:00:00Z',
    }

    const result = useEvidenceLadder(store, 'g1')
    const s2 = result.source.find((s) => s.id === 's2')
    expect(s2!.title).toBe('https://fallback.com')
  })
})

describe('useDerivationChain', () => {
  it('returns empty chain when entityId is null', () => {
    const store = makeTestStore()
    const result = useDerivationChain(store, null)

    expect(result.upstream).toEqual([])
    expect(result.downstream).toEqual([])
  })

  it('finds upstream derivation links', () => {
    const store = makeTestStore()
    const result = useDerivationChain(store, 'c1')

    expect(result.upstream).toHaveLength(1)
    expect(result.upstream[0]!.entityId).toBe('obs1')
    expect(result.upstream[0]!.relation).toBe('supports')
  })

  it('finds downstream derivation links', () => {
    const store = makeTestStore()
    const result = useDerivationChain(store, 'c2')

    expect(result.downstream).toHaveLength(1)
    expect(result.downstream[0]!.entityId).toBe('inf1')
    expect(result.downstream[0]!.relation).toBe('infers')
  })

  it('returns empty when entity has no derivations', () => {
    const store = makeTestStore()
    const result = useDerivationChain(store, 'a1')

    expect(result.upstream).toEqual([])
    expect(result.downstream).toEqual([])
  })
})
