import { describe, it, expect } from 'vitest'

import { buildGraphViewModel } from '../graph-selectors'
import { emptyCanonicalStore } from '../../../types/canonical'
import type { CanonicalStore } from '../../../types/canonical'

function makeTestStore(): CanonicalStore {
  const store = emptyCanonicalStore()

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

  store.games['g1'] = {
    id: 'g1',
    name: 'Test Game',
    description: 'A test game',
    semantic_labels: ['prisoners_dilemma'],
    players: ['p1', 'p2'],
    status: 'active',
    formalizations: ['f1'],
    coupling_links: [],
    key_assumptions: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }

  store.formalizations['f1'] = {
    id: 'f1',
    game_id: 'g1',
    kind: 'extensive_form',
    purpose: 'analysis',
    abstraction_level: 'full',
    assumptions: [],
    root_node_id: 'n1',
    information_sets: [],
  }

  store.nodes['n1'] = {
    id: 'n1',
    formalization_id: 'f1',
    actor: { kind: 'player', player_id: 'p1' },
    type: 'decision',
    label: 'Alice Decides',
  }

  store.nodes['n2'] = {
    id: 'n2',
    formalization_id: 'f1',
    actor: { kind: 'nature' },
    type: 'chance',
    label: 'Nature Roll',
  }

  store.nodes['n3'] = {
    id: 'n3',
    formalization_id: 'f1',
    actor: { kind: 'player', player_id: 'p2' },
    type: 'terminal',
    label: 'Outcome',
    terminal_payoffs: {
      p1: {
        representation: 'point',
        value: 10,
        confidence: 0.8,
        rationale: 'Best outcome for Alice',
        source_claims: [],
      },
      p2: {
        representation: 'point',
        value: 5,
        confidence: 0.7,
        rationale: 'Moderate for Bob',
        source_claims: [],
      },
    },
  }

  // Node from a different formalization (should be excluded)
  store.nodes['n_other'] = {
    id: 'n_other',
    formalization_id: 'f_other',
    actor: { kind: 'player', player_id: 'p1' },
    type: 'decision',
    label: 'Other Node',
  }

  store.edges['e1'] = {
    id: 'e1',
    formalization_id: 'f1',
    from: 'n1',
    to: 'n2',
    label: 'Cooperate',
  }

  store.edges['e2'] = {
    id: 'e2',
    formalization_id: 'f1',
    from: 'n2',
    to: 'n3',
    label: 'High Roll',
  }

  // Edge from a different formalization (should be excluded)
  store.edges['e_other'] = {
    id: 'e_other',
    formalization_id: 'f_other',
    from: 'n_other',
    to: 'n_other',
    label: 'Other Edge',
  }

  return store
}

describe('buildGraphViewModel', () => {
  it('returns empty view model when no formalization id is provided', () => {
    const store = makeTestStore()
    const result = buildGraphViewModel(store, null)

    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
    expect(result.formalization).toBeNull()
  })

  it('returns empty view model when formalization is not found', () => {
    const store = makeTestStore()
    const result = buildGraphViewModel(store, 'nonexistent')

    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
    expect(result.formalization).toBeNull()
  })

  it('maps formalization nodes to React Flow nodes', () => {
    const store = makeTestStore()
    const result = buildGraphViewModel(store, 'f1')

    expect(result.nodes).toHaveLength(3)
    expect(result.formalization).toBe(store.formalizations['f1'])

    const decisionNode = result.nodes.find((n) => n.id === 'n1')
    expect(decisionNode).toBeDefined()
    expect(decisionNode!.type).toBe('decision')
    expect(decisionNode!.data.label).toBe('Alice Decides')
    expect(decisionNode!.data.playerName).toBe('Alice')
    expect(decisionNode!.data.playerColor).toBe('#3B82F6')

    const chanceNode = result.nodes.find((n) => n.id === 'n2')
    expect(chanceNode).toBeDefined()
    expect(chanceNode!.type).toBe('chance')
    expect(chanceNode!.data.label).toBe('Nature Roll')
    expect(chanceNode!.data.playerName).toBeNull()

    const terminalNode = result.nodes.find((n) => n.id === 'n3')
    expect(terminalNode).toBeDefined()
    expect(terminalNode!.type).toBe('terminal')
    expect(terminalNode!.data.terminalPayoffs).toBeDefined()
  })

  it('maps formalization edges to React Flow edges', () => {
    const store = makeTestStore()
    const result = buildGraphViewModel(store, 'f1')

    expect(result.edges).toHaveLength(2)

    const edge1 = result.edges.find((e) => e.id === 'e1')
    expect(edge1).toBeDefined()
    expect(edge1!.source).toBe('n1')
    expect(edge1!.target).toBe('n2')
    expect(edge1!.type).toBe('game')
    expect(edge1!.data!.label).toBe('Cooperate')
  })

  it('excludes nodes and edges from other formalizations', () => {
    const store = makeTestStore()
    const result = buildGraphViewModel(store, 'f1')

    const otherNode = result.nodes.find((n) => n.id === 'n_other')
    expect(otherNode).toBeUndefined()

    const otherEdge = result.edges.find((e) => e.id === 'e_other')
    expect(otherEdge).toBeUndefined()
  })

  it('assigns different colors to different players', () => {
    const store = makeTestStore()
    const result = buildGraphViewModel(store, 'f1')

    const aliceNode = result.nodes.find((n) => n.data.playerId === 'p1')
    const bobNode = result.nodes.find((n) => n.data.playerId === 'p2')

    expect(aliceNode!.data.playerColor).not.toBe(bobNode!.data.playerColor)
  })

  it('handles stale markers on nodes', () => {
    const store = makeTestStore()
    store.nodes['n1'] = {
      ...store.nodes['n1']!,
      stale_markers: [
        {
          reason: 'Payoff changed',
          stale_since: '2026-01-02T00:00:00Z',
          caused_by: { type: 'game_edge', id: 'e1' },
        },
      ],
    }

    const result = buildGraphViewModel(store, 'f1')
    const node = result.nodes.find((n) => n.id === 'n1')

    expect(node!.data.staleMarkers).toHaveLength(1)
    expect(node!.data.staleMarkers![0]!.reason).toBe('Payoff changed')
  })
})
