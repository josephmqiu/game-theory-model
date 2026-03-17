import { describe, expect, it } from 'vitest'
import {
  createDefaultPromptRegistry,
  getActivePrompt,
  forkPrompt,
  compareRuns,
} from './prompt-registry'

describe('prompt registry', () => {
  it('seeds default prompts for all 10 phases', () => {
    const registry = createDefaultPromptRegistry()
    for (let phase = 1; phase <= 10; phase++) {
      expect(registry.active_versions[phase]).toBeDefined()
      expect(registry.official_versions[phase]).toBeDefined()
      const prompt = registry.versions[registry.active_versions[phase]]
      expect(prompt).toBeDefined()
      expect(prompt.phase).toBe(phase)
      expect(prompt.is_official).toBe(true)
      expect(prompt.content.length).toBeGreaterThan(0)
    }
  })

  it('returns the active prompt for a phase', () => {
    const registry = createDefaultPromptRegistry()
    const prompt = getActivePrompt(registry, 6)
    expect(prompt.phase).toBe(6)
    expect(prompt.is_official).toBe(true)
  })

  it('falls back to a default prompt for an unregistered phase', () => {
    const registry = createDefaultPromptRegistry()
    const prompt = getActivePrompt(registry, 99)
    expect(prompt.phase).toBe(99)
    expect(prompt.is_official).toBe(true)
  })

  it('forks a prompt and sets it as active', () => {
    const registry = createDefaultPromptRegistry()
    const { registry: updated, version } = forkPrompt(registry, 3, {
      name: 'Custom Phase 3',
      content: 'Custom instructions for baseline modeling.',
      description: 'Testing fork',
    })
    expect(version.phase).toBe(3)
    expect(version.is_official).toBe(false)
    expect(version.name).toBe('Custom Phase 3')
    expect(version.content).toBe('Custom instructions for baseline modeling.')
    expect(version.parent_id).toBe(registry.active_versions[3])
    expect(updated.active_versions[3]).toBe(version.id)
    // Official version unchanged
    expect(updated.official_versions[3]).toBe(registry.official_versions[3])
  })

  it('forks with defaults when no params provided', () => {
    const registry = createDefaultPromptRegistry()
    const original = getActivePrompt(registry, 1)
    const { version } = forkPrompt(registry, 1)
    expect(version.name).toBe(`${original.name} fork`)
    expect(version.content).toBe(original.content)
  })

  it('compareRuns detects prompt version changes', () => {
    const registry = createDefaultPromptRegistry()
    const { registry: updated, version: forked } = forkPrompt(registry, 2)

    const leftExecution = {
      id: 'exec_1', phase: 2, pass_number: 1,
      provider_id: 'test', model_id: 'test',
      prompt_version_id: registry.active_versions[2],
      started_at: '', completed_at: null, duration_ms: null,
      input_tokens: 0, output_tokens: 0, cost_usd: null,
      status: 'complete' as const, error: null,
    }
    const rightExecution = { ...leftExecution, id: 'exec_2', prompt_version_id: forked.id }

    const comparison = compareRuns(updated, leftExecution, rightExecution)
    expect(comparison.changed).toBe(true)
    expect(comparison.phase).toBe(2)
  })

  it('compareRuns reports no change for same version', () => {
    const registry = createDefaultPromptRegistry()
    const execution = {
      id: 'exec_1', phase: 5, pass_number: 1,
      provider_id: 'test', model_id: 'test',
      prompt_version_id: registry.active_versions[5],
      started_at: '', completed_at: null, duration_ms: null,
      input_tokens: 0, output_tokens: 0, cost_usd: null,
      status: 'complete' as const, error: null,
    }
    const comparison = compareRuns(registry, execution, execution)
    expect(comparison.changed).toBe(false)
  })
})
