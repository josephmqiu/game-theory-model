import { describe, it, expect } from 'vitest'

import {
  buildCreateGameCommand,
  buildCreatePlayerCommand,
  buildCreateNodeCommand,
  buildCreateEdgeCommand,
  buildCreateFormalizationCommand,
  buildCreateSourceCommand,
  buildCreateClaimCommand,
  buildCreateAssumptionCommand,
} from '../builders'

describe('buildCreateGameCommand', () => {
  it('produces an add_game command with correct payload', () => {
    const command = buildCreateGameCommand({
      name: 'Test Game',
      description: 'A strategic game',
      labels: ['prisoners_dilemma'],
      status: 'active',
    })

    expect(command.kind).toBe('add_game')
    expect(command.payload).toMatchObject({
      name: 'Test Game',
      description: 'A strategic game',
      status: 'active',
      semantic_labels: ['prisoners_dilemma'],
      players: [],
      formalizations: [],
    })
  })

  it('includes timestamps in the payload', () => {
    const command = buildCreateGameCommand({
      name: 'Test',
      description: 'Desc',
      labels: [],
      status: 'active',
    })

    const payload = command.payload as Record<string, unknown>
    expect(payload.created_at).toBeDefined()
    expect(payload.updated_at).toBeDefined()
  })
})

describe('buildCreatePlayerCommand', () => {
  it('produces an add_player command', () => {
    const command = buildCreatePlayerCommand({
      name: 'Alice',
      type: 'state',
      description: 'A state actor',
    })

    expect(command.kind).toBe('add_player')
    expect(command.payload).toMatchObject({
      name: 'Alice',
      type: 'state',
      objectives: [],
      constraints: [],
    })
  })

  it('includes description in metadata when provided', () => {
    const command = buildCreatePlayerCommand({
      name: 'Bob',
      type: 'individual',
      description: 'An individual player',
    })

    const payload = command.payload as Record<string, unknown>
    expect(payload.metadata).toEqual({ description: 'An individual player' })
  })

  it('omits metadata when no description', () => {
    const command = buildCreatePlayerCommand({
      name: 'Charlie',
      type: 'organization',
    })

    const payload = command.payload as Record<string, unknown>
    expect(payload.metadata).toBeUndefined()
  })
})

describe('buildCreateNodeCommand', () => {
  it('produces an add_game_node command for a player actor', () => {
    const command = buildCreateNodeCommand({
      formalizationId: 'f1',
      label: 'Alice Decides',
      type: 'decision',
      actorKind: 'player',
      playerId: 'p1',
    })

    expect(command.kind).toBe('add_game_node')
    expect(command.payload).toMatchObject({
      formalization_id: 'f1',
      label: 'Alice Decides',
      type: 'decision',
      actor: { kind: 'player', player_id: 'p1' },
    })
  })

  it('produces a nature actor when actorKind is nature', () => {
    const command = buildCreateNodeCommand({
      formalizationId: 'f1',
      label: 'Random Event',
      type: 'chance',
      actorKind: 'nature',
    })

    const payload = command.payload as Record<string, unknown>
    expect(payload.actor).toEqual({ kind: 'nature' })
  })
})

describe('buildCreateEdgeCommand', () => {
  it('produces an add_game_edge command', () => {
    const command = buildCreateEdgeCommand({
      formalizationId: 'f1',
      from: 'n1',
      to: 'n2',
      label: 'Cooperate',
    })

    expect(command.kind).toBe('add_game_edge')
    expect(command.payload).toMatchObject({
      formalization_id: 'f1',
      from: 'n1',
      to: 'n2',
      label: 'Cooperate',
    })
  })
})

describe('buildCreateFormalizationCommand', () => {
  it('produces a normal_form formalization command', () => {
    const command = buildCreateFormalizationCommand({
      gameId: 'g1',
      kind: 'normal_form',
      purpose: 'explanatory',
      abstractionLevel: 'medium',
    })

    expect(command.kind).toBe('add_formalization')
    expect(command.payload).toMatchObject({
      game_id: 'g1',
      kind: 'normal_form',
      purpose: 'explanatory',
      abstraction_level: 'medium',
      strategies: {},
      payoff_cells: [],
    })
  })

  it('produces an extensive_form formalization command', () => {
    const command = buildCreateFormalizationCommand({
      gameId: 'g1',
      kind: 'extensive_form',
      purpose: 'computational',
      abstractionLevel: 'detailed',
    })

    expect(command.kind).toBe('add_formalization')
    expect(command.payload).toMatchObject({
      game_id: 'g1',
      kind: 'extensive_form',
      purpose: 'computational',
      abstraction_level: 'detailed',
      root_node_id: '',
      information_sets: [],
    })
  })
})

describe('buildCreateSourceCommand', () => {
  it('produces an add_source command', () => {
    const command = buildCreateSourceCommand({
      kind: 'web',
      title: 'Reuters Article',
      url: 'https://reuters.com/article',
    })

    expect(command.kind).toBe('add_source')
    expect(command.payload).toMatchObject({
      kind: 'web',
      title: 'Reuters Article',
      url: 'https://reuters.com/article',
    })
    const payload = command.payload as Record<string, unknown>
    expect(payload.captured_at).toBeDefined()
  })
})

describe('buildCreateClaimCommand', () => {
  it('produces an add_claim command', () => {
    const command = buildCreateClaimCommand({
      statement: 'Trade sanctions are likely',
      confidence: 0.7,
      basedOn: ['obs1', 'obs2'],
    })

    expect(command.kind).toBe('add_claim')
    expect(command.payload).toMatchObject({
      statement: 'Trade sanctions are likely',
      confidence: 0.7,
      based_on: ['obs1', 'obs2'],
    })
  })
})

describe('buildCreateAssumptionCommand', () => {
  it('produces an add_assumption command', () => {
    const command = buildCreateAssumptionCommand({
      statement: 'All players are rational',
      type: 'behavioral',
      sensitivity: 'high',
      confidence: 0.85,
    })

    expect(command.kind).toBe('add_assumption')
    expect(command.payload).toMatchObject({
      statement: 'All players are rational',
      type: 'behavioral',
      sensitivity: 'high',
      confidence: 0.85,
    })
  })
})
