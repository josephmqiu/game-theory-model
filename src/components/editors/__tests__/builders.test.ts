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

function payload(command: { kind: string; payload?: unknown }): Record<string, unknown> {
  return (command as { payload: Record<string, unknown> }).payload
}

describe('buildCreateGameCommand', () => {
  it('produces an add_game command with correct payload', () => {
    const command = buildCreateGameCommand({
      name: 'Test Game',
      description: 'A strategic game',
      labels: ['prisoners_dilemma'],
      status: 'active',
    })

    expect(command.kind).toBe('add_game')
    expect(payload(command)).toMatchObject({
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

    const p = payload(command)
    expect(p.created_at).toBeDefined()
    expect(p.updated_at).toBeDefined()
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
    expect(payload(command)).toMatchObject({
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

    expect(payload(command).metadata).toEqual({ description: 'An individual player' })
  })

  it('omits metadata when no description', () => {
    const command = buildCreatePlayerCommand({
      name: 'Charlie',
      type: 'organization',
    })

    expect(payload(command).metadata).toBeUndefined()
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
    expect(payload(command)).toMatchObject({
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

    expect(payload(command).actor).toEqual({ kind: 'nature' })
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
    expect(payload(command)).toMatchObject({
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
    expect(payload(command)).toMatchObject({
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
    expect(payload(command)).toMatchObject({
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
    expect(payload(command)).toMatchObject({
      kind: 'web',
      title: 'Reuters Article',
      url: 'https://reuters.com/article',
    })
    expect(payload(command).captured_at).toBeDefined()
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
    expect(payload(command)).toMatchObject({
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
    expect(payload(command)).toMatchObject({
      statement: 'All players are rational',
      type: 'behavioral',
      sensitivity: 'high',
      confidence: 0.85,
    })
  })
})
