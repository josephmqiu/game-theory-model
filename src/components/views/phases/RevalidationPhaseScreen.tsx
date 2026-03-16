import { useMemo, useState, type ReactNode } from 'react'

import { Button } from '../../design-system'
import { usePipelineController } from '../../../hooks/usePipelineController'
import { useAppStore, usePipelineStore } from '../../../store'

export function RevalidationPhaseScreen(): ReactNode {
  const canonical = useAppStore((state) => state.canonical)
  const setInspectedRefs = useAppStore((state) => state.setInspectedRefs)
  const {
    activeRerunCycle,
    approveRevalidation,
    dismissRevalidation,
    forkPromptVersion,
    promptRegistry,
  } = usePipelineController()
  const [selectedPhase, setSelectedPhase] = useState(5)
  const [forkName, setForkName] = useState('')
  const [forkContent, setForkContent] = useState('')

  const events = useMemo(
    () => Object.values(canonical.revalidation_events)
      .sort((left, right) => right.triggered_at.localeCompare(left.triggered_at)),
    [canonical.revalidation_events],
  )

  const passNumber = usePipelineStore((state) => state.analysis_state?.pass_number ?? 1)
  const hasOpenRevalidation = Boolean(activeRerunCycle) || events.some((e) => e.resolution === 'pending')

  const convergenceText = hasOpenRevalidation
    ? `Still iterating \u2014 pass ${passNumber}`
    : passNumber > 1
      ? `Analysis converged after ${passNumber} passes`
      : 'No revalidation events'

  const convergenceWarning = passNumber >= 4
    ? 'This may indicate a genuinely complex situation, inadequate information, or a wrong abstraction.'
    : null

  const activePromptId = promptRegistry.active_versions[selectedPhase] ?? promptRegistry.official_versions[selectedPhase]
  const activePrompt = activePromptId ? promptRegistry.versions[activePromptId] : null

  function handleForkPrompt() {
    const version = forkPromptVersion(selectedPhase, {
      name: forkName || undefined,
      content: forkContent || activePrompt?.content,
      description: `Forked from Phase ${selectedPhase} dashboard`,
    })
    setForkName(version.name)
    setForkContent(version.content)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-primary">Phase 5: Recursive Revalidation</h1>
          <p className="mt-1 text-sm text-text-muted">
            Review trigger history, approve queued reruns, and manage the active analysis prompt versions.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-bg-card px-4 py-2 text-sm text-text-primary">
          {convergenceText}
          {convergenceWarning ? (
            <div className="mt-1 text-xs text-amber-500">{convergenceWarning}</div>
          ) : null}
        </div>
      </div>

      <section className="rounded-xl border border-border bg-bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Revalidation Log</h2>
            <p className="mt-1 text-xs text-text-muted">
              Pending events keep stale markers visible until you approve or dismiss the rerun.
            </p>
          </div>
        </div>

        {events.length === 0 ? (
          <p className="text-sm text-text-muted">No revalidation events have been recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="rounded-lg border border-border bg-bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-text-dim">
                  <span>{event.trigger_condition.replace(/_/g, ' ')}</span>
                  <span>Phase {event.source_phase}</span>
                  <span>Pass {event.pass_number}</span>
                  <span>{event.resolution.replace(/_/g, ' ')}</span>
                </div>
                <p className="mt-2 text-sm text-text-primary">{event.description}</p>
                <div className="mt-2 text-xs text-text-muted">
                  Target phases: P{event.target_phases.join(', P')}
                </div>
                {event.entity_refs.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {event.entity_refs.map((ref) => (
                      <button
                        key={`${event.id}:${ref.type}:${ref.id}`}
                        type="button"
                        className="rounded border border-border px-2 py-1 text-[11px] text-text-muted hover:border-accent hover:text-text-primary"
                        onClick={() => setInspectedRefs([ref])}
                      >
                        {ref.type.replace(/_/g, ' ')} · {ref.id}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    onClick={() => void approveRevalidation(event.id)}
                    disabled={event.resolution !== 'pending'}
                  >
                    Approve rerun
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => dismissRevalidation(event.id)}
                    disabled={event.resolution !== 'pending'}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-bg-card p-4">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-text-primary">Prompt Versions</h2>
          <p className="mt-1 text-xs text-text-muted">
            Each phase uses a versioned prompt. Forking here switches the selected phase to your draft.
          </p>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="text-sm text-text-primary" htmlFor="phase-prompt-select">Phase</label>
          <select
            id="phase-prompt-select"
            className="rounded border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary"
            value={selectedPhase}
            onChange={(event) => {
              const nextPhase = Number(event.target.value)
              setSelectedPhase(nextPhase)
              const nextPromptId = promptRegistry.active_versions[nextPhase] ?? promptRegistry.official_versions[nextPhase]
              const nextPrompt = nextPromptId ? promptRegistry.versions[nextPromptId] : null
              setForkName(nextPrompt?.name ?? '')
              setForkContent(nextPrompt?.content ?? '')
            }}
          >
            {Array.from({ length: 10 }, (_, index) => {
              const phase = index + 1
              return (
                <option key={phase} value={phase}>
                  Phase {phase}
                </option>
              )
            })}
          </select>
        </div>

        {activePrompt ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-bg-surface p-3">
              <div className="text-sm font-semibold text-text-primary">{activePrompt.name}</div>
              <div className="mt-1 text-xs text-text-muted">
                {activePrompt.is_official ? 'Official prompt' : 'User fork'} · {activePrompt.id}
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-text-primary">{activePrompt.content}</div>
            </div>

            <label className="block text-sm text-text-primary" htmlFor="fork-name">
              Fork name
            </label>
            <input
              id="fork-name"
              className="w-full rounded border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary"
              value={forkName}
              onChange={(event) => setForkName(event.target.value)}
              placeholder={`Phase ${selectedPhase} custom prompt`}
            />

            <label className="block text-sm text-text-primary" htmlFor="fork-content">
              Fork content
            </label>
            <textarea
              id="fork-content"
              className="min-h-40 w-full rounded border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary"
              value={forkContent || activePrompt.content}
              onChange={(event) => setForkContent(event.target.value)}
            />

            <Button variant="primary" onClick={handleForkPrompt}>
              Fork active prompt
            </Button>
          </div>
        ) : (
          <p className="text-sm text-text-muted">No prompt is registered for Phase {selectedPhase}.</p>
        )}
      </section>
    </div>
  )
}
