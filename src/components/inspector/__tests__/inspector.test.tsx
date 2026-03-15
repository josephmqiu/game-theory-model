import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { EntityDetail } from '../EntityDetail'
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
    metadata: { description: 'A test player' },
  }

  store.games['g1'] = {
    id: 'g1',
    name: 'Prisoner Dilemma',
    description: 'Classic PD game',
    semantic_labels: ['prisoners_dilemma'],
    players: ['p1'],
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
    purpose: 'explanatory',
    abstraction_level: 'detailed',
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
    description: 'Alice chooses to cooperate or defect',
  }

  store.edges['e1'] = {
    id: 'e1',
    formalization_id: 'f1',
    from: 'n1',
    to: 'n1',
    label: 'Cooperate',
  }

  store.assumptions['a1'] = {
    id: 'a1',
    statement: 'Players are rational',
    type: 'behavioral',
    sensitivity: 'high',
    confidence: 0.9,
  }

  store.claims['c1'] = {
    id: 'c1',
    statement: 'Cooperation is dominant',
    based_on: ['obs1'],
    confidence: 0.75,
  }

  return store
}

describe('EntityDetail', () => {
  it('renders game details', () => {
    const store = makeTestStore()
    render(<EntityDetail entityRef={{ type: 'game', id: 'g1' }} canonical={store} />)

    expect(screen.getByText('Prisoner Dilemma')).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('renders player details', () => {
    const store = makeTestStore()
    render(<EntityDetail entityRef={{ type: 'player', id: 'p1' }} canonical={store} />)

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('individual')).toBeInTheDocument()
    expect(screen.getByText('Prisoner Dilemma')).toBeInTheDocument()
  })

  it('renders game node details', () => {
    const store = makeTestStore()
    render(<EntityDetail entityRef={{ type: 'game_node', id: 'n1' }} canonical={store} />)

    expect(screen.getByText('Alice Decides')).toBeInTheDocument()
    expect(screen.getByText('decision')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('renders game edge details', () => {
    const store = makeTestStore()
    render(<EntityDetail entityRef={{ type: 'game_edge', id: 'e1' }} canonical={store} />)

    // "Cooperate" appears as both Card title and Action value
    const cooperateElements = screen.getAllByText('Cooperate')
    expect(cooperateElements.length).toBeGreaterThanOrEqual(1)
    // "Alice Decides" appears in both From and To (self-loop edge in test data)
    const aliceElements = screen.getAllByText('Alice Decides')
    expect(aliceElements).toHaveLength(2)
    expect(screen.getByText('From')).toBeInTheDocument()
    expect(screen.getByText('To')).toBeInTheDocument()
    expect(screen.getByText('Action')).toBeInTheDocument()
  })

  it('renders formalization details', () => {
    const store = makeTestStore()
    render(<EntityDetail entityRef={{ type: 'formalization', id: 'f1' }} canonical={store} />)

    expect(screen.getByText('extensive_form')).toBeInTheDocument()
    expect(screen.getByText('explanatory')).toBeInTheDocument()
    expect(screen.getByText('Prisoner Dilemma')).toBeInTheDocument()
  })

  it('renders assumption details', () => {
    const store = makeTestStore()
    render(<EntityDetail entityRef={{ type: 'assumption', id: 'a1' }} canonical={store} />)

    expect(screen.getByText('Players are rational')).toBeInTheDocument()
    expect(screen.getByText('behavioral')).toBeInTheDocument()
    expect(screen.getByText('high')).toBeInTheDocument()
    expect(screen.getByText('0.9')).toBeInTheDocument()
  })

  it('renders claim details', () => {
    const store = makeTestStore()
    render(<EntityDetail entityRef={{ type: 'claim', id: 'c1' }} canonical={store} />)

    expect(screen.getByText('Cooperation is dominant')).toBeInTheDocument()
    expect(screen.getByText('0.75')).toBeInTheDocument()
  })

  it('shows not found message for missing entities', () => {
    const store = makeTestStore()
    render(<EntityDetail entityRef={{ type: 'game', id: 'nonexistent' }} canonical={store} />)

    expect(screen.getByText('Game not found')).toBeInTheDocument()
  })

  it('renders stale markers on entities', () => {
    const store = makeTestStore()
    store.games['g1'] = {
      ...store.games['g1']!,
      stale_markers: [
        {
          reason: 'Player objectives changed',
          stale_since: '2026-01-02T00:00:00Z',
          caused_by: { type: 'player', id: 'p1' },
        },
      ],
    }

    render(<EntityDetail entityRef={{ type: 'game', id: 'g1' }} canonical={store} />)

    expect(screen.getByText('STALE')).toBeInTheDocument()
    expect(screen.getByText('Player objectives changed')).toBeInTheDocument()
  })
})
