import { describe, it, expect } from 'vitest'

import { useNormalFormViewModel, findCell } from '../normal-form-selectors'
import { emptyCanonicalStore } from '../../../types/canonical'
import type { CanonicalStore } from '../../../types/canonical'
import type { EstimateValue } from '../../../types/estimates'

function makeEstimate(value: number, confidence: number): EstimateValue {
  return {
    representation: 'cardinal_estimate',
    value,
    confidence,
    rationale: `Payoff of ${value}`,
    source_claims: [],
  }
}

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
    name: 'Prisoner Dilemma',
    description: 'Classic PD',
    semantic_labels: ['prisoners_dilemma'],
    players: ['p1', 'p2'],
    status: 'active',
    formalizations: ['nf1'],
    coupling_links: [],
    key_assumptions: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }

  store.formalizations['nf1'] = {
    id: 'nf1',
    game_id: 'g1',
    kind: 'normal_form',
    purpose: 'explanatory',
    abstraction_level: 'coarse',
    assumptions: [],
    strategies: {
      p1: ['Cooperate', 'Defect'],
      p2: ['Cooperate', 'Defect'],
    },
    payoff_cells: [
      {
        strategy_profile: { p1: 'Cooperate', p2: 'Cooperate' },
        payoffs: { p1: makeEstimate(3, 0.9), p2: makeEstimate(3, 0.9) },
      },
      {
        strategy_profile: { p1: 'Cooperate', p2: 'Defect' },
        payoffs: { p1: makeEstimate(0, 0.8), p2: makeEstimate(5, 0.8) },
      },
      {
        strategy_profile: { p1: 'Defect', p2: 'Cooperate' },
        payoffs: { p1: makeEstimate(5, 0.8), p2: makeEstimate(0, 0.8) },
      },
      {
        strategy_profile: { p1: 'Defect', p2: 'Defect' },
        payoffs: { p1: makeEstimate(1, 0.9), p2: makeEstimate(1, 0.9) },
      },
    ],
  }

  return store
}

describe('useNormalFormViewModel', () => {
  it('returns empty view model when formalization id is null', () => {
    const store = makeTestStore()
    const result = useNormalFormViewModel(store, null)

    expect(result.players).toEqual([])
    expect(result.cells).toEqual([])
    expect(result.formalization).toBeNull()
  })

  it('returns empty view model when formalization is not found', () => {
    const store = makeTestStore()
    const result = useNormalFormViewModel(store, 'nonexistent')

    expect(result.players).toEqual([])
    expect(result.formalization).toBeNull()
  })

  it('returns empty view model for non-normal-form formalization', () => {
    const store = makeTestStore()
    store.formalizations['ef1'] = {
      id: 'ef1',
      game_id: 'g1',
      kind: 'extensive_form',
      purpose: 'explanatory',
      abstraction_level: 'detailed',
      assumptions: [],
      root_node_id: 'n1',
      information_sets: [],
    }

    const result = useNormalFormViewModel(store, 'ef1')
    expect(result.formalization).toBeNull()
  })

  it('builds matrix data from normal-form formalization', () => {
    const store = makeTestStore()
    const result = useNormalFormViewModel(store, 'nf1')

    expect(result.players).toEqual(['p1', 'p2'])
    expect(result.rowStrategies).toEqual(['Cooperate', 'Defect'])
    expect(result.colStrategies).toEqual(['Cooperate', 'Defect'])
    expect(result.cells).toHaveLength(4)
    expect(result.formalization).toBeDefined()
    expect(result.formalization!.id).toBe('nf1')
  })

  it('maps cell payoffs correctly', () => {
    const store = makeTestStore()
    const result = useNormalFormViewModel(store, 'nf1')

    const ccCell = result.cells.find(
      (c) => c.rowStrategy === 'Cooperate' && c.colStrategy === 'Cooperate',
    )
    expect(ccCell).toBeDefined()
    expect(ccCell!.payoffs['p1']!.value).toBe(3)
    expect(ccCell!.payoffs['p2']!.value).toBe(3)

    const cdCell = result.cells.find(
      (c) => c.rowStrategy === 'Cooperate' && c.colStrategy === 'Defect',
    )
    expect(cdCell).toBeDefined()
    expect(cdCell!.payoffs['p1']!.value).toBe(0)
    expect(cdCell!.payoffs['p2']!.value).toBe(5)
  })
})

describe('findCell', () => {
  it('finds cell by strategy profile', () => {
    const store = makeTestStore()
    const vm = useNormalFormViewModel(store, 'nf1')
    const cell = findCell(vm, 'Defect', 'Cooperate')

    expect(cell).toBeDefined()
    expect(cell!.payoffs['p1']!.value).toBe(5)
    expect(cell!.payoffs['p2']!.value).toBe(0)
  })

  it('returns undefined for missing strategy profile', () => {
    const store = makeTestStore()
    const vm = useNormalFormViewModel(store, 'nf1')
    const cell = findCell(vm, 'Unknown', 'Cooperate')

    expect(cell).toBeUndefined()
  })
})
