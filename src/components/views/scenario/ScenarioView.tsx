import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'

import { useAppStore } from '../../../store'
import { Button, Badge } from '../../design-system'
import { CreatePlaybookWizard, CreateScenarioWizard } from '../../editors/wizards'

export function ScenarioView(): ReactNode {
  const canonical = useAppStore((s) => s.canonical)
  const activeFormalizationId = useAppStore((s) => s.viewState.activeFormalizationId)

  const [showScenarioWizard, setShowScenarioWizard] = useState(false)
  const [showPlaybookWizard, setShowPlaybookWizard] = useState(false)

  const scenarios = useMemo(
    () => Object.values(canonical.scenarios).filter((scenario) => scenario.formalization_id === activeFormalizationId),
    [canonical.scenarios, activeFormalizationId],
  )
  const playbooks = useMemo(
    () => Object.values(canonical.playbooks).filter((playbook) => playbook.formalization_id === activeFormalizationId),
    [canonical.playbooks, activeFormalizationId],
  )

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-bg-page p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-mono font-bold text-lg tracking-widest text-text-primary">SCENARIOS</h1>
          <p className="mt-1 text-xs text-text-muted">
            Build branching futures and related playbooks for the selected formalization.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Plus size={14} />} onClick={() => setShowPlaybookWizard(true)}>
            Playbook
          </Button>
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowScenarioWizard(true)}>
            Scenario
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded border border-border bg-bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Badge>Scenarios</Badge>
            <span className="font-mono text-xs text-text-muted">{scenarios.length}</span>
          </div>
          {scenarios.length === 0 ? (
            <p className="text-sm text-text-muted">No scenarios yet for this formalization.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {scenarios.map((scenario) => (
                <div key={scenario.id} className="rounded border border-border bg-bg-surface p-3">
                  <div className="font-mono text-sm text-text-primary">{scenario.name}</div>
                  {scenario.narrative && (
                    <p className="mt-2 text-xs text-text-muted">{scenario.narrative}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded border border-border bg-bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Badge>Playbooks</Badge>
            <span className="font-mono text-xs text-text-muted">{playbooks.length}</span>
          </div>
          {playbooks.length === 0 ? (
            <p className="text-sm text-text-muted">No playbooks yet for this formalization.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {playbooks.map((playbook) => (
                <div key={playbook.id} className="rounded border border-border bg-bg-surface p-3">
                  <div className="font-mono text-sm text-text-primary">{playbook.name}</div>
                  {playbook.notes && (
                    <p className="mt-2 text-xs text-text-muted">{playbook.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <CreateScenarioWizard open={showScenarioWizard} onClose={() => setShowScenarioWizard(false)} />
      <CreatePlaybookWizard open={showPlaybookWizard} onClose={() => setShowPlaybookWizard(false)} />
    </div>
  )
}
