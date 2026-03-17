import type {
  PhaseExecution,
  PromptRegistry,
  PromptRunComparison,
  PromptVersion,
} from '../types/analysis-pipeline'

const DEFAULT_PROMPT_CONTENT: Record<number, string> = {
  1: 'Ground the situation across the seven evidence categories and produce structured evidence proposals only.',
  2: 'Identify players, objectives, information asymmetries, and any hidden internal agency as structured proposals.',
  3: 'Build the smallest baseline strategic model that explains the core interaction and expose its gaps.',
  4: 'Map the repeated-game history, trust, and dynamic inconsistency risks affecting the baseline.',
  5: 'Review trigger conditions, stale model areas, and queued reruns before resuming downstream work.',
  6: 'Formalize the stabilized game structure using structured models and solver-backed outputs.',
  7: 'Extract assumptions, rate sensitivity, and classify empirical versus game-theoretic dependencies.',
  8: 'Eliminate implausible outcomes with explicit citations to prior phase findings.',
  9: 'Generate scenarios and central theses with transparent invalidation conditions.',
  10: 'Run the meta-check, adversarial challenge, and final confidence review.',
}

function createDefaultPromptVersion(phase: number): PromptVersion {
  return {
    id: `prompt_phase_${phase}_official`,
    phase,
    name: `Phase ${phase} official`,
    content: DEFAULT_PROMPT_CONTENT[phase] ?? `Phase ${phase} analysis prompt.`,
    parent_id: null,
    is_official: true,
    created_at: new Date().toISOString(),
    metadata: {
      author: 'system',
      description: `Seeded default prompt for Phase ${phase}.`,
      tags: ['official', `phase-${phase}`],
    },
  }
}

export function createDefaultPromptRegistry(): PromptRegistry {
  const versions: Record<string, PromptVersion> = {}
  const active_versions: Record<number, string> = {}
  const official_versions: Record<number, string> = {}

  for (let phase = 1; phase <= 10; phase += 1) {
    const prompt = createDefaultPromptVersion(phase)
    versions[prompt.id] = prompt
    active_versions[phase] = prompt.id
    official_versions[phase] = prompt.id
  }

  return {
    versions,
    active_versions,
    official_versions,
  }
}

export function getActivePrompt(
  registry: PromptRegistry,
  phase: number,
): PromptVersion {
  const activeId = registry.active_versions[phase] ?? registry.official_versions[phase]
  return registry.versions[activeId] ?? createDefaultPromptVersion(phase)
}

export function forkPrompt(
  registry: PromptRegistry,
  phase: number,
  params?: { name?: string; content?: string; description?: string },
): { registry: PromptRegistry; version: PromptVersion } {
  const active = getActivePrompt(registry, phase)
  const version: PromptVersion = {
    id: `prompt_phase_${phase}_${crypto.randomUUID()}`,
    phase,
    name: params?.name?.trim() || `${active.name} fork`,
    content: params?.content?.trim() || active.content,
    parent_id: active.id,
    is_official: false,
    created_at: new Date().toISOString(),
    metadata: {
      author: 'user',
      description: params?.description?.trim() || `Forked from ${active.name}.`,
      tags: ['fork', `phase-${phase}`],
    },
  }

  return {
    registry: {
      ...registry,
      versions: {
        ...registry.versions,
        [version.id]: version,
      },
      active_versions: {
        ...registry.active_versions,
        [phase]: version.id,
      },
    },
    version,
  }
}

export function compareRuns(
  registry: PromptRegistry,
  left: PhaseExecution,
  right: PhaseExecution,
): PromptRunComparison {
  const leftPrompt = registry.versions[left.prompt_version_id]
  const rightPrompt = registry.versions[right.prompt_version_id]
  const changed = left.prompt_version_id !== right.prompt_version_id

  return {
    phase: left.phase,
    left_prompt_version_id: left.prompt_version_id,
    right_prompt_version_id: right.prompt_version_id,
    changed,
    summary: changed
      ? `Prompt changed from "${leftPrompt?.name ?? left.prompt_version_id}" to "${rightPrompt?.name ?? right.prompt_version_id}".`
      : `Prompt remained "${leftPrompt?.name ?? left.prompt_version_id}".`,
  }
}
