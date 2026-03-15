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
  buildCreateObservationCommand,
  buildCreateInferenceCommand,
  buildCreateContradictionCommand,
  buildCreateLatentFactorCommand,
  buildCreateCrossGameLinkCommand,
  buildCreateScenarioCommand,
  buildCreatePlaybookCommand,
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
  it('produces a player creation batch command', () => {
    const command = buildCreatePlayerCommand({
      name: 'Alice',
      type: 'state',
      description: 'A state actor',
      gameIds: [],
    })

    expect(command.kind).toBe('batch')
    const batch = command as { kind: 'batch'; commands: Array<{ kind: string; payload?: unknown }> }
    expect(batch.commands[0]!.kind).toBe('add_player')
    expect(payload(batch.commands[0]!)).toMatchObject({
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
      gameIds: [],
    })

    const batch = command as { kind: 'batch'; commands: Array<{ kind: string; payload?: unknown }> }
    expect(payload(batch.commands[0]!).metadata).toEqual({ description: 'An individual player' })
  })

  it('omits metadata when no description', () => {
    const command = buildCreatePlayerCommand({
      name: 'Charlie',
      type: 'organization',
      gameIds: [],
    })

    const batch = command as { kind: 'batch'; commands: Array<{ kind: string; payload?: unknown }> }
    expect(payload(batch.commands[0]!).metadata).toBeUndefined()
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

    expect(command.kind).toBe('batch')
    const batch = command as { kind: 'batch'; commands: Array<{ kind: string; payload?: unknown }> }
    expect(batch.commands).toHaveLength(2)
    expect(batch.commands[0]!.kind).toBe('add_formalization')
    expect(batch.commands[1]!.kind).toBe('attach_formalization_to_game')
    expect(payload(batch.commands[0]!)).toMatchObject({
      game_id: 'g1',
      kind: 'normal_form',
      purpose: 'explanatory',
      abstraction_level: 'medium',
      strategies: {},
      payoff_cells: [],
    })
  })

  it('produces an extensive_form formalization command as batch with root node', () => {
    const command = buildCreateFormalizationCommand({
      gameId: 'g1',
      kind: 'extensive_form',
      purpose: 'computational',
      abstractionLevel: 'detailed',
    })

    expect(command.kind).toBe('batch')
    const batch = command as { kind: 'batch'; commands: Array<{ kind: string; payload?: unknown; id?: string }> }
    expect(batch.commands).toHaveLength(3)
    expect(batch.commands[0]!.kind).toBe('add_formalization')
    expect(batch.commands[1]!.kind).toBe('attach_formalization_to_game')
    expect(batch.commands[2]!.kind).toBe('add_game_node')

    const formPayload = batch.commands[0]!.payload as Record<string, unknown>
    expect(formPayload).toMatchObject({
      game_id: 'g1',
      kind: 'extensive_form',
      purpose: 'computational',
      abstraction_level: 'detailed',
      information_sets: [],
    })
    // root_node_id should reference the auto-created node
    expect(formPayload.root_node_id).toBe(batch.commands[2]!.id)
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

describe('buildCreateObservationCommand', () => {
  it('produces an add_observation command', () => {
    const command = buildCreateObservationCommand({
      sourceId: 's1',
      text: 'Troop movements observed near border',
    })

    expect(command.kind).toBe('add_observation')
    expect(payload(command)).toMatchObject({
      source_id: 's1',
      text: 'Troop movements observed near border',
    })
    expect(payload(command).captured_at).toBeDefined()
  })
})

describe('buildCreateInferenceCommand', () => {
  it('produces an add_inference command', () => {
    const command = buildCreateInferenceCommand({
      statement: 'Military escalation is likely',
      derivedFrom: ['c1', 'c2'],
      confidence: 0.75,
      rationale: 'Based on troop movements and rhetoric',
    })

    expect(command.kind).toBe('add_inference')
    expect(payload(command)).toMatchObject({
      statement: 'Military escalation is likely',
      derived_from: ['c1', 'c2'],
      confidence: 0.75,
      rationale: 'Based on troop movements and rhetoric',
    })
  })
})

describe('buildCreateContradictionCommand', () => {
  it('produces an add_contradiction command', () => {
    const command = buildCreateContradictionCommand({
      leftRef: 'c1',
      rightRef: 'c2',
      description: 'Claims about intent conflict',
      resolutionStatus: 'open',
      notes: 'Need more data',
    })

    expect(command.kind).toBe('add_contradiction')
    expect(payload(command)).toMatchObject({
      left_ref: 'c1',
      right_ref: 'c2',
      description: 'Claims about intent conflict',
      resolution_status: 'open',
      notes: 'Need more data',
    })
  })

  it('omits notes when not provided', () => {
    const command = buildCreateContradictionCommand({
      leftRef: 'c1',
      rightRef: 'c2',
      description: 'Conflict',
      resolutionStatus: 'open',
    })

    expect(payload(command).notes).toBeUndefined()
  })
})

describe('buildCreateLatentFactorCommand', () => {
  it('produces an add_latent_factor command', () => {
    const command = buildCreateLatentFactorCommand({
      name: 'Regime Stability',
      description: 'Internal political stability of the regime',
      states: [
        { label: 'stable', probability: 0.6, confidence: 0.7 },
        { label: 'unstable', probability: 0.4, confidence: 0.7 },
      ],
      affects: ['g1'],
    })

    expect(command.kind).toBe('add_latent_factor')
    expect(payload(command)).toMatchObject({
      name: 'Regime Stability',
      description: 'Internal political stability of the regime',
      states: [
        { label: 'stable', probability: 0.6, confidence: 0.7 },
        { label: 'unstable', probability: 0.4, confidence: 0.7 },
      ],
      affects: ['g1'],
    })
  })
})

describe('buildCreateCrossGameLinkCommand', () => {
  it('produces an add_cross_game_link command', () => {
    const command = buildCreateCrossGameLinkCommand({
      sourceGameId: 'g1',
      targetGameId: 'g2',
      triggerRef: 'e1',
      effectType: 'payoff_shift',
      targetRef: 'n5',
      rationale: 'Sanctions affect trade payoffs',
      targetPlayerId: 'p2',
    })

    expect(command.kind).toBe('add_cross_game_link')
    expect(payload(command)).toMatchObject({
      source_game_id: 'g1',
      target_game_id: 'g2',
      trigger_ref: 'e1',
      effect_type: 'payoff_shift',
      target_ref: 'n5',
      rationale: 'Sanctions affect trade payoffs',
      target_player_id: 'p2',
    })
  })

  it('omits target_player_id when not provided', () => {
    const command = buildCreateCrossGameLinkCommand({
      sourceGameId: 'g1',
      targetGameId: 'g2',
      triggerRef: 'e1',
      effectType: 'timing_change',
      targetRef: 'n5',
      rationale: 'Timing change',
    })

    expect(payload(command).target_player_id).toBeUndefined()
  })
})

describe('buildCreateScenarioCommand', () => {
  it('produces an add_scenario command', () => {
    const command = buildCreateScenarioCommand({
      name: 'Escalation Path',
      formalizationId: 'f1',
      narrative: 'Both sides escalate over 3 rounds',
      probabilityModel: 'independent',
    })

    expect(command.kind).toBe('add_scenario')
    expect(payload(command)).toMatchObject({
      name: 'Escalation Path',
      formalization_id: 'f1',
      path: [],
      probability_model: 'independent',
      key_assumptions: [],
      invalidators: [],
      narrative: 'Both sides escalate over 3 rounds',
    })
  })
})

describe('buildCreatePlaybookCommand', () => {
  it('produces an add_playbook command', () => {
    const command = buildCreatePlaybookCommand({
      name: 'Deterrence Playbook',
      formalizationId: 'f1',
      notes: 'Focus on credible threats',
    })

    expect(command.kind).toBe('add_playbook')
    expect(payload(command)).toMatchObject({
      name: 'Deterrence Playbook',
      formalization_id: 'f1',
      role_assignments: {},
      notes: 'Focus on credible threats',
    })
  })

  it('omits notes when not provided', () => {
    const command = buildCreatePlaybookCommand({
      name: 'Basic',
      formalizationId: 'f1',
    })

    expect(payload(command).notes).toBeUndefined()
  })
})
