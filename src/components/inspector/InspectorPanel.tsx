import type { ReactNode } from 'react'
import { X } from 'lucide-react'

import { useAppStore } from '../../store'
import { EntityDetail } from './EntityDetail'
import { InlineEditor } from './InlineEditor'

export function InspectorPanel(): ReactNode {
  const inspectedRefs = useAppStore((s) => s.viewState.inspectedRefs)
  const canonical = useAppStore((s) => s.canonical)
  const setInspectedRefs = useAppStore((s) => s.setInspectedRefs)

  if (inspectedRefs.length === 0) {
    return null
  }

  const primaryRef = inspectedRefs[0]!

  return (
    <div
      className="w-[320px] flex-shrink-0 h-full border-l border-border bg-bg-surface overflow-y-auto"
      data-testid="inspector-panel"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wide text-text-muted">
          Inspector
        </h2>
        <button
          onClick={() => setInspectedRefs([])}
          className="text-text-muted hover:text-text-primary transition-colors p-1"
          aria-label="Close inspector"
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-4">
        <EntityDetail entityRef={primaryRef} canonical={canonical} />
        <InlineEditor entityRef={primaryRef} canonical={canonical} />

        {inspectedRefs.length > 1 && (
          <div className="mt-3 text-[11px] text-text-muted font-mono">
            + {inspectedRefs.length - 1} more selected
          </div>
        )}
      </div>
    </div>
  )
}
