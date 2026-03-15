import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'

import { useAppStore } from '../../../store'
import { refKey } from '../../../types/canonical'
import { Button } from '../../design-system'
import { coordinationBus, useCoordinationHandler } from '../../../coordination'
import {
  selectEvidenceLadder,
  LADDER_ORDER,
  type EvidenceNotebookEntry,
  type EvidenceLadderType,
} from '../../../store/selectors/evidence-notebook-selectors'
import { EvidenceCard } from './EvidenceCard'
import { ContradictionCard } from './ContradictionCard'
import {
  CreateEvidenceWizard,
  CreateObservationWizard,
  CreateClaimWizard,
  CreateInferenceWizard,
  CreateAssumptionWizard,
  CreateContradictionWizard,
} from '../../editors/wizards'

const SECTION_LABELS: Record<EvidenceLadderType, string> = {
  source: 'Sources',
  observation: 'Observations',
  claim: 'Claims',
  inference: 'Inferences',
  assumption: 'Assumptions',
  contradiction: 'Contradictions',
}

type WizardKind = 'source' | 'observation' | 'claim' | 'inference' | 'assumption' | 'contradiction'

function entityTypeForLadderType(ladderType: EvidenceLadderType): string {
  switch (ladderType) {
    case 'source':
      return 'source'
    case 'observation':
      return 'observation'
    case 'claim':
      return 'claim'
    case 'inference':
      return 'inference'
    case 'assumption':
      return 'assumption'
    case 'contradiction':
      return 'contradiction'
    default:
      return ladderType
  }
}

export function EvidenceNotebook(): ReactNode {
  const canonical = useAppStore((s) => s.canonical)
  const activeGameId = useAppStore((s) => s.viewState.activeGameId)
  const inverseIndex = useAppStore((s) => s.inverseIndex)
  const setInspectedRefs = useAppStore((s) => s.setInspectedRefs)
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())

  const [activeWizard, setActiveWizard] = useState<WizardKind | null>(null)

  const ladder = useMemo(
    () => selectEvidenceLadder(canonical, activeGameId),
    [canonical, activeGameId],
  )

  const findDependentNodeRefs = useCallback(
    (entityType: string, entityId: string) => {
      const key = refKey({ type: entityType as import('../../../types/canonical').EntityType, id: entityId })
      const dependents = inverseIndex[key] ?? []
      return dependents.filter((ref) => ref.type === 'game_node')
    },
    [inverseIndex],
  )

  const handleCardClick = useCallback(
    (entry: EvidenceNotebookEntry) => {
      const entityType = entityTypeForLadderType(entry.type)
      const refs = [{ type: entityType as import('../../../types/canonical').EntityType, id: entry.id }]

      setInspectedRefs(refs)

      coordinationBus.emit({
        kind: 'focus_entity',
        source_view: 'evidence_notebook',
        correlation_id: crypto.randomUUID(),
        ref: refs[0]!,
      })

      // Use InverseIndex to find game nodes that reference this evidence item
      const dependentNodeRefs = findDependentNodeRefs(entityType, entry.id)

      coordinationBus.emit({
        kind: 'highlight_dependents',
        source_view: 'evidence_notebook',
        correlation_id: crypto.randomUUID(),
        root_ref: refs[0]!,
        dependent_refs: dependentNodeRefs,
      })
    },
    [setInspectedRefs, findDependentNodeRefs],
  )

  const handleContradictionClick = useCallback(
    (contradictionId: string) => {
      const refs = [{ type: 'contradiction' as const, id: contradictionId }]

      setInspectedRefs(refs)

      coordinationBus.emit({
        kind: 'focus_entity',
        source_view: 'evidence_notebook',
        correlation_id: crypto.randomUUID(),
        ref: refs[0]!,
      })

      // Use InverseIndex to find game nodes that reference this contradiction
      const dependentNodeRefs = findDependentNodeRefs('contradiction', contradictionId)

      coordinationBus.emit({
        kind: 'highlight_dependents',
        source_view: 'evidence_notebook',
        correlation_id: crypto.randomUUID(),
        root_ref: refs[0]!,
        dependent_refs: dependentNodeRefs,
      })
    },
    [setInspectedRefs, findDependentNodeRefs],
  )

  // Cross-view sync: scroll to entity on focus_entity events
  const handleFocusEntity = useCallback(
    (event: import('../../../coordination/types').CoordinationEvent) => {
      if (event.kind !== 'focus_entity') return
      if (event.source_view === 'evidence_notebook') return

      const targetId = event.ref.id
      const cardEl = cardRefsMap.current.get(targetId)
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    },
    [],
  )

  useCoordinationHandler('focus_entity', handleFocusEntity)

  const setCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      cardRefsMap.current.set(id, el)
    } else {
      cardRefsMap.current.delete(id)
    }
  }, [])

  const closeWizard = useCallback(() => setActiveWizard(null), [])

  if (!activeGameId) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted">
        <div className="text-center">
          <div className="text-lg font-heading mb-2">No game selected</div>
          <div className="text-sm">
            Select a game from the sidebar to view its evidence notebook.
          </div>
        </div>
      </div>
    )
  }

  const gameName = canonical.games[activeGameId]?.name ?? 'Unknown Game'

  return (
    <div
      ref={containerRef}
      className="flex-1 h-full overflow-y-auto"
      data-testid="evidence-notebook"
    >
      <div className="max-w-3xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-heading font-bold text-text-primary">
            Evidence Notebook — {gameName}
          </h1>
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Plus size={14} />} onClick={() => setActiveWizard('source')}>
              Source
            </Button>
            <Button variant="secondary" icon={<Plus size={14} />} onClick={() => setActiveWizard('observation')}>
              Observation
            </Button>
            <Button variant="secondary" icon={<Plus size={14} />} onClick={() => setActiveWizard('claim')}>
              Claim
            </Button>
          </div>
        </div>

        {LADDER_ORDER.map((type) => {
          const entries = ladder[type]

          return (
            <section key={type} className="mb-6">
              <div className="flex items-center justify-between sticky top-0 bg-bg-page py-1 z-10">
                <h2 className="text-xs font-mono font-bold uppercase tracking-wide text-text-muted">
                  {SECTION_LABELS[type]}
                  <span className="ml-2 text-text-muted font-normal">({entries.length})</span>
                </h2>
                {(type === 'inference' || type === 'assumption' || type === 'contradiction') && (
                  <button
                    onClick={() => setActiveWizard(type)}
                    className="text-[10px] font-mono text-accent hover:text-text-primary transition-colors"
                  >
                    + ADD
                  </button>
                )}
              </div>

              {entries.length === 0 ? (
                <div className="text-xs text-text-muted italic py-2">
                  No {SECTION_LABELS[type].toLowerCase()} yet
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {type === 'contradiction'
                    ? entries.map((entry) => (
                        <div
                          key={entry.id}
                          ref={(el) => setCardRef(entry.id, el)}
                        >
                          <ContradictionCard
                            contradictionId={entry.id}
                            canonical={canonical}
                            onClick={handleContradictionClick}
                          />
                        </div>
                      ))
                    : entries.map((entry) => (
                        <div
                          key={entry.id}
                          ref={(el) => setCardRef(entry.id, el)}
                        >
                          <EvidenceCard
                            entry={entry}
                            onClick={handleCardClick}
                          />
                        </div>
                      ))}
                </div>
              )}
            </section>
          )
        })}
      </div>

      <CreateEvidenceWizard open={activeWizard === 'source'} onClose={closeWizard} />
      <CreateObservationWizard open={activeWizard === 'observation'} onClose={closeWizard} />
      <CreateClaimWizard open={activeWizard === 'claim'} onClose={closeWizard} />
      <CreateInferenceWizard open={activeWizard === 'inference'} onClose={closeWizard} />
      <CreateAssumptionWizard open={activeWizard === 'assumption'} onClose={closeWizard} />
      <CreateContradictionWizard open={activeWizard === 'contradiction'} onClose={closeWizard} />
    </div>
  )
}
