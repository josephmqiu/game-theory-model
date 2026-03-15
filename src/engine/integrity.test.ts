import { beforeEach, describe, expect, it } from 'vitest'

import { createSampleCanonicalStore } from '../test-support/sample-analysis'
import { dispatch, createEventLog } from './dispatch'
import { resetPersistedEventStore } from './event-persistence'
import { computeImpact, expandCascade } from './cascade'
import { buildInverseIndex, refreshInverseIndexForEntities } from './inverse-index'
import { createEntityRef, refKey } from '../types/canonical'

describe('integrity and cascade behavior', () => {
  beforeEach(() => {
    resetPersistedEventStore()
  })

  it('cascades source deletion through observations and stale-marks emptied claims', () => {
    const store = createSampleCanonicalStore()
    const result = dispatch(store, createEventLog('/analysis.gta.json'), {
      kind: 'delete_source',
      payload: { id: 'source_1' },
    })

    expect(result.status).toBe('committed')
    if (result.status !== 'committed') {
      throw new Error('Expected delete_source to commit.')
    }

    expect(result.store.sources.source_1).toBeUndefined()
    expect(result.store.observations.observation_1).toBeUndefined()
    expect(result.store.claims.claim_1.based_on).toEqual([])
    expect(result.store.claims.claim_1.stale_markers?.some((marker) => marker.caused_by.id === 'claim_1')).toBe(true)
  })

  it('removes a deleted player from a game and marks the game stale if its roster empties', () => {
    const store = createSampleCanonicalStore()
    store.games.game_1.players = ['player_1']

    const result = dispatch(store, createEventLog('/analysis.gta.json'), {
      kind: 'delete_player',
      payload: { id: 'player_1' },
    })

    expect(result.status).toBe('committed')
    if (result.status !== 'committed') {
      throw new Error('Expected delete_player to commit.')
    }

    expect(result.store.games.game_1.players).toEqual([])
    expect(result.store.games.game_1.stale_markers?.length).toBeGreaterThan(0)
  })

  it('computes impact reports and indexes wildcard references', () => {
    const store = createSampleCanonicalStore()
    store.nodes.game_node_1.terminal_payoffs = {
      player_1: {
        representation: 'cardinal_estimate',
        value: 1,
        confidence: 0.5,
        rationale: 'test',
        source_claims: ['claim_1'],
      },
    }

    const index = buildInverseIndex(store)
    expect(index[refKey(createEntityRef('claim', 'claim_1'))]).toContainEqual(
      createEntityRef('game_node', 'game_node_1'),
    )

    const impact = computeImpact(store, index, createEntityRef('source', 'source_1'))
    expect(impact.direct_dependents).toContainEqual(createEntityRef('observation', 'observation_1'))
    expect(impact.severity).toBe('destructive')
  })

  it('marks scenarios stale when a referenced edge is deleted and updates the inverse index incrementally', () => {
    const store = createSampleCanonicalStore()
    const index = buildInverseIndex(store)

    const addResult = dispatch(store, createEventLog('/analysis.gta.json'), {
      kind: 'add_claim',
      payload: {
        statement: 'Incremental claim',
        based_on: ['observation_1'],
        confidence: 0.4,
      },
    })

    expect(addResult.status).toBe('committed')
    if (addResult.status !== 'committed') {
      throw new Error('Expected add_claim to commit.')
    }

    const newClaimId = Object.keys(addResult.store.claims).find((id) => id !== 'claim_1')!
    const refreshed = refreshInverseIndexForEntities(
      index,
      store,
      addResult.store,
      [createEntityRef('claim', newClaimId)],
    )
    expect(refreshed[refKey(createEntityRef('observation', 'observation_1'))]).toContainEqual(
      createEntityRef('claim', newClaimId),
    )

    const deleteEdge = dispatch(store, createEventLog('/analysis.gta.json'), {
      kind: 'delete_game_edge',
      payload: { id: 'game_edge_1' },
    })

    expect(deleteEdge.status).toBe('committed')
    if (deleteEdge.status !== 'committed') {
      throw new Error('Expected delete_game_edge to commit.')
    }
    expect(deleteEdge.store.scenarios.scenario_1.stale_markers?.length).toBeGreaterThan(0)
  })

  it('expands delete cascades into atomic batch commands', () => {
    const store = createSampleCanonicalStore()
    const expanded = expandCascade(
      store,
      buildInverseIndex(store),
      {
        kind: 'delete_source',
        payload: { id: 'source_1' },
      },
    )

    expect(expanded.kind).toBe('batch')
    if (expanded.kind !== 'batch') {
      throw new Error('Expected expanded cascade batch.')
    }
    expect(expanded.commands.some((command) => command.kind === 'delete_observation')).toBe(true)
    expect(expanded.commands.some((command) => command.kind === 'mark_stale')).toBe(true)
  })
})

