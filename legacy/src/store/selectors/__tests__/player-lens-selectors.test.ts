import { describe, it, expect } from 'vitest'

import { selectPlayerLens } from '../player-lens-selectors'
import { emptyCanonicalStore } from '../../../types/canonical'
import type { CanonicalStore } from '../../../types/canonical'

function makeTestStore(): CanonicalStore {
  const store = emptyCanonicalStore()

  store.players['p1'] = {
    id: 'p1',
    name: 'Alice',
    type: 'state',
    objectives: [
      {
        label: 'Maximize security',
        weight: {
          representation: 'cardinal_estimate',
          value: 0.8,
          confidence: 0.7,
          rationale: 'Primary objective',
          source_claims: [],
        },
        description: 'National security priority',
      },
    ],
    constraints: [],
  }

  store.players['p2'] = {
    id: 'p2',
    name: 'Bob',
    type: 'organization',
    objectives: [],
    constraints: [],
  }

  store.games['g1'] = {
    id: 'g1',
    name: 'Deterrence Game',
    description: 'Testing deterrence',
    semantic_labels: ['deterrence'],
    players: ['p1', 'p2'],
    status: 'active',
    formalizations: ['f1'],
    coupling_links: [],
    key_assumptions: ['a1'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }

  store.games['g2'] = {
    id: 'g2',
    name: 'Trade Game',
    description: 'Trade negotiations',
    semantic_labels: ['bargaining'],
    players: ['p1'],
    status: 'paused',
    formalizations: [],
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
    assumptions: ['a2'],
    root_node_id: 'n1',
    information_sets: [],
  }

  store.assumptions['a1'] = {
    id: 'a1',
    statement: 'Players are rational',
    type: 'behavioral',
    sensitivity: 'high',
    confidence: 0.9,
    stale_markers: [
      {
        reason: 'New evidence contradicts this',
        stale_since: '2026-03-10T00:00:00Z',
        caused_by: { type: 'claim', id: 'c1' },
      },
    ],
  }

  store.assumptions['a2'] = {
    id: 'a2',
    statement: 'Complete information',
    type: 'structural',
    sensitivity: 'medium',
    confidence: 0.7,
  }

  return store
}

describe('selectPlayerLens', () => {
  it('returns null when playerId is null', () => {
    const store = makeTestStore()
    const result = selectPlayerLens(store, null)
    expect(result).toBeNull()
  })

  it('returns null when player does not exist', () => {
    const store = makeTestStore()
    const result = selectPlayerLens(store, 'nonexistent')
    expect(result).toBeNull()
  })

  it('returns correct player lens data', () => {
    const store = makeTestStore()
    const result = selectPlayerLens(store, 'p1')

    expect(result).not.toBeNull()
    expect(result!.playerId).toBe('p1')
    expect(result!.playerName).toBe('Alice')
    expect(result!.gamesInvolved).toHaveLength(2)
    expect(result!.objectives).toHaveLength(1)
    expect(result!.objectives[0]!.label).toBe('Maximize security')
  })

  it('detects stale assumptions as pressure points', () => {
    const store = makeTestStore()
    const result = selectPlayerLens(store, 'p1')

    expect(result!.pressurePoints.length).toBeGreaterThan(0)
    const staleAssumption = result!.pressurePoints.find(
      (pp) => pp.entity_ref.id === 'a1',
    )
    expect(staleAssumption).toBeDefined()
    expect(staleAssumption!.reason).toBe('New evidence contradicts this')
  })

  it('identifies cross-game exposure', () => {
    const store = makeTestStore()

    store.cross_game_links['cgl1'] = {
      id: 'cgl1',
      source_game_id: 'g1',
      target_game_id: 'g2',
      trigger_ref: 'n1',
      effect_type: 'payoff_shift',
      target_ref: 'n2',
      target_player_id: 'p1',
      rationale: 'Deterrence outcome affects trade',
      source_claims: [],
    }

    const result = selectPlayerLens(store, 'p1')

    expect(result!.crossGameExposure).toHaveLength(1)
    expect(result!.crossGameExposure[0]!.sourceGameName).toBe('Deterrence Game')
    expect(result!.crossGameExposure[0]!.targetGameName).toBe('Trade Game')
  })
})
