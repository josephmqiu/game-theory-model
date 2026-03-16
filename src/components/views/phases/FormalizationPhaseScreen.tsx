import { useEffect, useMemo, type ReactNode } from 'react'

import { useAppStore, usePipelineStore } from '../../../store'
import type { FormalizationResult } from '../../../types/analysis-pipeline'
import { MatrixView } from '../matrix/MatrixView'
import { TreeView } from '../tree/TreeView'

function formatTitle(label: string): string {
  return label.replace(/_/g, ' ')
}

export function FormalizationPhaseScreen(): ReactNode {
  const canonical = useAppStore((state) => state.canonical)
  const activeGameId = useAppStore((state) => state.viewState.activeGameId)
  const activeFormalizationId = useAppStore((state) => state.viewState.activeFormalizationId)
  const setActiveFormalization = useAppStore((state) => state.setActiveFormalization)
  const setActiveGame = useAppStore((state) => state.setActiveGame)
  const phaseResult = usePipelineStore((state) => state.phase_results[6] as FormalizationResult | undefined)

  const summaries = phaseResult?.formal_representations.summaries ?? []
  const activeSummary = summaries.find((summary) => summary.formalization_id === activeFormalizationId) ?? summaries[0] ?? null
  const activeFormalization = activeSummary
    ? canonical.formalizations[activeSummary.formalization_id]
    : null
  const activeAnalysis = phaseResult?.baseline_equilibria.analyses.find(
    (analysis) => analysis.formalization_id === activeSummary?.formalization_id,
  ) ?? null

  useEffect(() => {
    if (!activeSummary) {
      return
    }
    if (activeGameId !== activeSummary.game_id) {
      setActiveGame(activeSummary.game_id)
    }
    if (activeFormalizationId !== activeSummary.formalization_id) {
      setActiveFormalization(activeSummary.formalization_id)
    }
  }, [activeFormalizationId, activeGameId, activeSummary, setActiveFormalization, setActiveGame])

  const subsectionCards = useMemo(
    () => phaseResult?.subsection_statuses ?? [],
    [phaseResult],
  )

  if (!phaseResult) {
    return (
      <div className="flex-1 p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="px-2 py-1 bg-bg-surface border border-border rounded text-xs font-mono text-text-muted">P6</span>
          <h1 className="text-lg font-bold text-text-primary">Phase 6: Full Formalization</h1>
        </div>
        <p className="text-sm text-text-muted">Run Phase 6 to populate the formalization workspace.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-text-primary">Phase 6: Full Formalization</h1>
          <p className="mt-1 text-sm text-text-muted">
            Review the proposed formal representations, solver summaries, and cross-cutting overlays before moving to Phase 7.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-bg-card px-4 py-2 text-sm text-text-primary">
          {phaseResult.status.status === 'complete'
            ? 'All requested Phase 6 sections completed'
            : 'Phase 6 returned partial coverage'}
        </div>
      </div>

      <section className="rounded-xl border border-border bg-bg-card p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-text-primary">Subsection Progress</h2>
          <p className="mt-1 text-xs text-text-muted">
            Phase 6 runs the 6a-6i stack in order and stores derived summaries without auto-promoting them into canonical truth.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {subsectionCards.map((entry) => (
            <div key={entry.subsection} className="rounded-lg border border-border bg-bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-text-primary">{entry.subsection}</span>
                <span className="text-[11px] uppercase tracking-wide text-text-muted">{formatTitle(entry.status)}</span>
              </div>
              <p className="mt-2 text-sm text-text-primary">{entry.summary}</p>
              {entry.warnings.length > 0 ? (
                <div className="mt-2 text-xs text-amber-600">
                  {entry.warnings[0]}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Formalizations</h2>
            <p className="mt-1 text-xs text-text-muted">
              Select a formalization to inspect the embedded matrix/tree workspace and the derived solver-readiness summary.
            </p>
          </div>
        </div>
        {summaries.length === 0 ? (
          <p className="text-sm text-text-muted">No formalizations were produced in this pass.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {summaries.map((summary) => (
                <button
                  key={summary.formalization_id}
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    activeSummary?.formalization_id === summary.formalization_id
                      ? 'border-accent bg-bg-surface text-text-primary'
                      : 'border-border bg-bg-card text-text-muted'
                  }`}
                  onClick={() => {
                    setActiveGame(summary.game_id)
                    setActiveFormalization(summary.formalization_id)
                  }}
                >
                  {summary.game_name} · {formatTitle(summary.kind)}
                </button>
              ))}
            </div>

            {activeSummary ? (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-lg border border-border bg-bg-surface p-3">
                  {activeSummary.kind === 'normal_form' ? (
                    <MatrixView />
                  ) : activeSummary.kind === 'extensive_form' ? (
                    <TreeView />
                  ) : (
                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-text-primary">
                        {activeSummary.game_name} · {formatTitle(activeSummary.kind)}
                      </div>
                      <p className="text-sm text-text-muted">
                        This formalization uses the Phase 6 summary cards rather than the matrix/tree editor surface.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-bg-surface p-3">
                    <div className="text-xs font-mono uppercase tracking-wide text-text-muted">Selected Formalization</div>
                    <div className="mt-2 text-sm font-semibold text-text-primary">{formatTitle(activeSummary.kind)}</div>
                    <div className="mt-1 text-xs text-text-muted">
                      {activeSummary.reused_existing ? 'Reused existing Phase 3/accepted model' : 'Proposed in Phase 6'}
                    </div>
                    <p className="mt-2 text-sm text-text-primary">{activeSummary.rationale}</p>
                  </div>

                  <div className="rounded-lg border border-border bg-bg-surface p-3">
                    <div className="text-xs font-mono uppercase tracking-wide text-text-muted">Solver / Readiness</div>
                    {activeAnalysis ? (
                      <div className="mt-2 space-y-2">
                        <div className="text-sm text-text-primary">
                          {activeAnalysis.readiness.overall.replace(/_/g, ' ')} · {activeAnalysis.readiness.supported_solvers.join(', ') || 'no supported solvers'}
                        </div>
                        {activeAnalysis.solver_summaries.map((summary) => (
                          <div key={`${activeAnalysis.formalization_id}:${summary.solver}`} className="rounded border border-border px-3 py-2">
                            <div className="text-xs uppercase tracking-wide text-text-muted">{formatTitle(summary.solver)}</div>
                            <div className="mt-1 text-sm text-text-primary">{summary.summary}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-text-muted">No derived solver summary is available for this formalization yet.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {phaseResult.bargaining_dynamics ? (
        <section className="rounded-xl border border-border bg-bg-card p-4">
          <h2 className="text-sm font-semibold text-text-primary">Bargaining Dynamics</h2>
          <p className="mt-2 text-sm text-text-primary">{phaseResult.bargaining_dynamics.summary}</p>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-bg-card p-4">
        <h2 className="text-sm font-semibold text-text-primary">Communication Analysis</h2>
        {phaseResult.communication_analysis.classifications.length > 0 ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {phaseResult.communication_analysis.classifications.map((classification) => (
              <div key={classification.id} className="rounded-lg border border-border bg-bg-surface p-3">
                <div className="text-xs uppercase tracking-wide text-text-muted">{formatTitle(classification.classification)}</div>
                <p className="mt-2 text-sm text-text-primary">{classification.summary}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-text-muted">No standalone communication-classification proposal was needed in this pass.</p>
        )}
      </section>

      {phaseResult.option_value ? (
        <section className="rounded-xl border border-border bg-bg-card p-4">
          <h2 className="text-sm font-semibold text-text-primary">Option Value</h2>
          <p className="mt-2 text-sm text-text-primary">{phaseResult.option_value.summary}</p>
        </section>
      ) : null}

      {phaseResult.behavioral_overlays ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="text-xs font-mono uppercase tracking-wide text-amber-700">
            {phaseResult.behavioral_overlays.label}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {phaseResult.behavioral_overlays.overlays.map((overlay) => (
              <div key={overlay.label} className="rounded-lg border border-amber-200 bg-white p-3">
                <div className="text-sm font-semibold text-text-primary">{overlay.label}</div>
                <p className="mt-2 text-sm text-text-primary">{overlay.summary}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {phaseResult.cross_game_effects ? (
        <section className="rounded-xl border border-border bg-bg-card p-4">
          <h2 className="text-sm font-semibold text-text-primary">Cross-Game Effects</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {phaseResult.cross_game_effects.effects.map((effect) => (
              <div key={`${effect.source_game_id}:${effect.target_game_id}:${effect.effect_type}`} className="rounded-lg border border-border bg-bg-surface p-3">
                <div className="text-xs uppercase tracking-wide text-text-muted">{formatTitle(effect.effect_type)}</div>
                <p className="mt-2 text-sm text-text-primary">{effect.summary}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
