import { describe, it, expect } from 'vitest'

import { selectExtensiveFormViewModel } from '../extensive-form-selectors'
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
    formalizations: ['ef1'],
    coupling_links: [],
    key_assumptions: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }

  store.formalizations['ef1'] = {
    id: 'ef1',
    game_id: 'g1',
    kind: 'extensive_form',
    purpose: 'explanatory',
    abstraction_level: 'detailed',
    assumptions: [],
    root_node_id: 'n1',
    information_sets: [
      {
        id: 'is1',
        player_id: 'p2',
        node_ids: ['n2', 'n3'],
      },
    ],
  }

  store.nodes['n1'] = {
    id: 'n1',
    formalization_id: 'ef1',
    actor: { kind: 'player', player_id: 'p1' },
    type: 'decision',
    label: 'Alice Chooses',
  }

  store.nodes['n2'] = {
    id: 'n2',
    formalization_id: 'ef1',
    actor: { kind: 'player', player_id: 'p2' },
    type: 'decision',
    label: 'Bob Responds (Left)',
  }

  store.nodes['n3'] = {
    id: 'n3',
    formalization_id: 'ef1',
    actor: { kind: 'player', player_id: 'p2' },
    type: 'decision',
    label: 'Bob Responds (Right)',
  }

  store.nodes['n4'] = {
    id: 'n4',
    formalization_id: 'ef1',
    actor: { kind: 'player', player_id: 'p1' },
    type: 'terminal',
    label: 'Outcome A',
    terminal_payoffs: {
      p1: {
        representation: 'cardinal_estimate',
        value: 3,
        confidence: 0.9,
        rationale: 'Mutual cooperation',
        source_claims: [],
      },
      p2: {
        representation: 'cardinal_estimate',
        value: 3,
        confidence: 0.9,
        rationale: 'Mutual cooperation',
        source_claims: [],
      },
    },
  }

  store.nodes['n5'] = {
    id: 'n5',
    formalization_id: 'ef1',
    actor: { kind: 'player', player_id: 'p1' },
    type: 'terminal',
    label: 'Outcome B',
  }

  // Node from a different formalization
  store.nodes['n_other'] = {
    id: 'n_other',
    formalization_id: 'f_other',
    actor: { kind: 'player', player_id: 'p1' },
    type: 'decision',
    label: 'Other Node',
  }

  store.edges['e1'] = {
    id: 'e1',
    formalization_id: 'ef1',
    from: 'n1',
    to: 'n2',
    label: 'Left',
  }

  store.edges['e2'] = {
    id: 'e2',
    formalization_id: 'ef1',
    from: 'n1',
    to: 'n3',
    label: 'Right',
  }

  store.edges['e3'] = {
    id: 'e3',
    formalization_id: 'ef1',
    from: 'n2',
    to: 'n4',
    label: 'Accept',
  }

  store.edges['e4'] = {
    id: 'e4',
    formalization_id: 'ef1',
    from: 'n3',
    to: 'n5',
    label: 'Reject',
  }

  return store
}

describe('selectExtensiveFormViewModel', () => {
  it('returns empty view model when formalization id is null', () => {
    const store = makeTestStore()
    const result = selectExtensiveFormViewModel(store, null)

    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
    expect(result.rootNodeId).toBeNull()
    expect(result.formalization).toBeNull()
  })

  it('returns empty view model when formalization is not found', () => {
    const store = makeTestStore()
    const result = selectExtensiveFormViewModel(store, 'nonexistent')

    expect(result.nodes).toEqual([])
    expect(result.formalization).toBeNull()
  })

  it('returns empty view model for non-extensive-form formalization', () => {
    const store = makeTestStore()
    store.formalizations['nf1'] = {
      id: 'nf1',
      game_id: 'g1',
      kind: 'normal_form',
      purpose: 'explanatory',
      abstraction_level: 'minimal',
      assumptions: [],
      strategies: {},
      payoff_cells: [],
    }

    const result = selectExtensiveFormViewModel(store, 'nf1')
    expect(result.formalization).toBeNull()
  })

  it('builds tree view model from extensive-form formalization', () => {
    const store = makeTestStore()
    const result = selectExtensiveFormViewModel(store, 'ef1')

    // Should include only nodes from ef1 (5 nodes), not n_other
    expect(result.nodes).toHaveLength(5)
    expect(result.edges).toHaveLength(4)
    expect(result.rootNodeId).toBe('n1')
    expect(result.formalization).toBeDefined()
    expect(result.formalization!.id).toBe('ef1')
  })

  it('assigns tree layout positions from root', () => {
    const store = makeTestStore()
    const result = selectExtensiveFormViewModel(store, 'ef1')

    const rootNode = result.nodes.find((n) => n.id === 'n1')
    expect(rootNode).toBeDefined()
    expect(rootNode!.position.y).toBe(0) // Root at top

    const childNode = result.nodes.find((n) => n.id === 'n2')
    expect(childNode).toBeDefined()
    expect(childNode!.position.y).toBe(150) // One level down
  })

  it('maps information sets', () => {
    const store = makeTestStore()
    const result = selectExtensiveFormViewModel(store, 'ef1')

    expect(result.informationSets).toHaveLength(1)
    expect(result.informationSets[0]!.id).toBe('is1')
    expect(result.informationSets[0]!.playerId).toBe('p2')
    expect(result.informationSets[0]!.nodeIds).toEqual(['n2', 'n3'])
  })

  it('excludes nodes from other formalizations', () => {
    const store = makeTestStore()
    const result = selectExtensiveFormViewModel(store, 'ef1')

    const otherNode = result.nodes.find((n) => n.id === 'n_other')
    expect(otherNode).toBeUndefined()
  })

  it('assigns player colors and names', () => {
    const store = makeTestStore()
    const result = selectExtensiveFormViewModel(store, 'ef1')

    const aliceNode = result.nodes.find((n) => n.data.playerId === 'p1')
    expect(aliceNode).toBeDefined()
    expect(aliceNode!.data.playerName).toBe('Alice')
    expect(aliceNode!.data.playerColor).toBe('#3B82F6')

    const bobNode = result.nodes.find((n) => n.data.playerId === 'p2')
    expect(bobNode).toBeDefined()
    expect(bobNode!.data.playerName).toBe('Bob')
    expect(bobNode!.data.playerColor).toBe('#EF4444')
  })

  it('maps terminal node payoffs', () => {
    const store = makeTestStore()
    const result = selectExtensiveFormViewModel(store, 'ef1')

    const terminalNode = result.nodes.find((n) => n.id === 'n4')
    expect(terminalNode).toBeDefined()
    expect(terminalNode!.data.terminalPayoffs).toBeDefined()
    expect(terminalNode!.data.terminalPayoffs!['p1']!.value).toBe(3)
  })
})
