import { beforeEach, describe, expect, it } from 'vitest'

import { createSampleCanonicalStore } from '../test-support/sample-analysis'
import { createEntityRef, refKey } from '../types/canonical'
import { dispatch, createEventLog } from './dispatch'
import { resetPersistedEventStore } from './event-persistence'
import { validateStoreInvariants } from './integrity'
import { computeImpact, expandCascade } from './cascade'
import { buildInverseIndex, refreshInverseIndexForEntities } from './inverse-index'

describe('integrity and cascade behavior', () => {
  beforeEach(() => {
    resetPersistedEventStore()
  })

  it('cascades source deletion through observations and stale-marks emptied claims with the deleted dependency as cause', () => {
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
    expect(
      result.store.claims.claim_1.stale_markers?.some(
        (marker) => marker.caused_by.type === 'observation' && marker.caused_by.id === 'observation_1',
      ),
    ).toBe(true)
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
    expect(
      result.store.games.game_1.stale_markers?.some(
        (marker) => marker.caused_by.type === 'player' && marker.caused_by.id === 'player_1',
      ),
    ).toBe(true)
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
    expect(
      deleteEdge.store.scenarios.scenario_1.stale_markers?.some(
        (marker) => marker.caused_by.type === 'game_edge' && marker.caused_by.id === 'game_edge_1',
      ),
    ).toBe(true)
  })

  it('cascade-deletes contradictions that reference a deleted claim', () => {
    const store = createSampleCanonicalStore()

    const result = dispatch(store, createEventLog('/analysis.gta.json'), {
      kind: 'delete_claim',
      payload: { id: 'claim_1' },
    })

    expect(result.status).toBe('committed')
    if (result.status !== 'committed') {
      throw new Error('Expected delete_claim to commit.')
    }

    expect(result.store.claims.claim_1).toBeUndefined()
    expect(result.store.contradictions.contradiction_1).toBeUndefined()
  })

  it('cascades game deletion through formalizations, nodes, and edges while stale-marking external scenarios', () => {
    const store = createSampleCanonicalStore()
    store.players.player_3 = {
      id: 'player_3',
      name: 'State C',
      type: 'state',
      objectives: [],
      constraints: [],
    }
    store.games.game_2 = {
      ...structuredClone(store.games.game_1),
      id: 'game_2',
      name: 'Linked spillover game',
      players: ['player_3'],
      formalizations: ['formalization_2'],
      coupling_links: [],
    }
    store.formalizations.formalization_2 = {
      ...structuredClone(store.formalizations.formalization_1),
      id: 'formalization_2',
      game_id: 'game_2',
      assumptions: [],
      notes: 'External formalization that still references the first game edge.',
    }
    store.scenarios.scenario_2 = {
      ...structuredClone(store.scenarios.scenario_1),
      id: 'scenario_2',
      formalization_id: 'formalization_2',
      path: ['game_edge_1'],
      key_assumptions: [],
      invalidators: [],
    }

    const result = dispatch(store, createEventLog('/analysis.gta.json'), {
      kind: 'delete_game',
      payload: { id: 'game_1' },
    })

    expect(result.status).toBe('committed')
    if (result.status !== 'committed') {
      throw new Error('Expected delete_game to commit.')
    }

    expect(result.store.games.game_1).toBeUndefined()
    expect(result.store.formalizations.formalization_1).toBeUndefined()
    expect(result.store.nodes.game_node_1).toBeUndefined()
    expect(result.store.edges.game_edge_1).toBeUndefined()
    expect(result.store.scenarios.scenario_2).toBeDefined()
    expect(
      result.store.scenarios.scenario_2.stale_markers?.some(
        (marker) => marker.caused_by.type === 'game_edge' && marker.caused_by.id === 'game_edge_1',
      ),
    ).toBe(true)
  })

  it('rejects unrelated dangling refs even when a stale marker explains a different missing dependency', () => {
    const store = createSampleCanonicalStore()
    store.scenarios.scenario_1.path = ['game_edge_missing']
    store.scenarios.scenario_1.key_assumptions = ['assumption_missing']
    store.scenarios.scenario_1.stale_markers = [
      {
        reason: 'Key assumption was removed',
        stale_since: '2026-03-14T02:00:00Z',
        caused_by: { type: 'assumption', id: 'assumption_missing' },
      },
    ]

    const result = validateStoreInvariants(store)

    expect(result.errors.some((error) => error.includes('game_edge_missing'))).toBe(true)
  })

  it('expands delete cascades into atomic batch commands without encoding stale fallout as explicit mark_stale commands', () => {
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
    expect(expanded.commands.some((command) => command.kind === 'mark_stale')).toBe(false)
  })
})
