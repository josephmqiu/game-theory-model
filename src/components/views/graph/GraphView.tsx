import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type OnSelectionChangeFunc,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus } from 'lucide-react'

import { useAppStore } from '../../../store'
import { buildGraphViewModel } from '../../../store/selectors/graph-selectors'
import { useCoordinationChannel, useCoordinationHandler } from '../../../coordination'
import type { CoordinationEvent } from '../../../coordination'
import { DecisionNode } from './nodes/DecisionNode'
import { ChanceNode } from './nodes/ChanceNode'
import { TerminalNode } from './nodes/TerminalNode'
import { GameEdge } from './edges/GameEdge'
import { EmptyStateNewGame } from '../../shell/EmptyStateNewGame'
import { Button } from '../../design-system'
import { CreateNodeWizard, CreateEdgeWizard } from '../../editors/wizards'

const nodeTypes: NodeTypes = {
  decision: DecisionNode,
  chance: ChanceNode,
  terminal: TerminalNode,
}

const edgeTypes: EdgeTypes = {
  game: GameEdge,
}

export function GraphView(): ReactNode {
  const canonical = useAppStore((s) => s.canonical)
  const activeFormalizationId = useAppStore((s) => s.viewState.activeFormalizationId)
  const activeGameId = useAppStore((s) => s.viewState.activeGameId)
  const setInspectedRefs = useAppStore((s) => s.setInspectedRefs)
  const coordination = useCoordinationChannel('graph')

  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set())
  const [showCreateNode, setShowCreateNode] = useState(false)
  const [showCreateEdge, setShowCreateEdge] = useState(false)

  const { nodes, edges, formalization } = useMemo(
    () => buildGraphViewModel(canonical, activeFormalizationId),
    [canonical, activeFormalizationId],
  )

  const nodesWithHighlight = useMemo(
    () =>
      nodes.map((node) =>
        highlightedIds.size > 0
          ? {
              ...node,
              data: {
                ...node.data,
                highlighted: highlightedIds.has(node.id),
              },
            }
          : node,
      ),
    [nodes, highlightedIds],
  )

  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes }) => {
      const refs = selectedNodes.map((n) => ({
        type: 'game_node' as const,
        id: n.id,
      }))

      setInspectedRefs(refs)

      coordination.emit({
        kind: 'selection_changed',
        refs,
      })
    },
    [setInspectedRefs, coordination],
  )

  const handleHighlightDependents = useCallback((event: CoordinationEvent) => {
    if (event.kind !== 'highlight_dependents') return
    setHighlightedIds(new Set(event.dependent_refs.map((r) => r.id)))
  }, [])

  const handleHighlightClear = useCallback((_event: CoordinationEvent) => {
    setHighlightedIds(new Set())
  }, [])

  useCoordinationHandler(coordination, 'highlight_dependents', handleHighlightDependents)
  useCoordinationHandler(coordination, 'highlight_clear', handleHighlightClear)

  if (!formalization) {
    const activeGame = activeGameId ? canonical.games[activeGameId] : null
    if (activeGame && activeGame.formalizations.length === 0) {
      return <EmptyStateNewGame />
    }

    return (
      <div className="flex-1 flex items-center justify-center text-text-muted">
        <div className="text-center">
          <div className="text-lg font-heading mb-2">No formalization selected</div>
          <div className="text-sm">
            Select a game and formalization from the sidebar to view its graph.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 h-full" data-testid="graph-canvas">
      <div className="absolute right-6 top-6 z-10 flex gap-2">
        <Button variant="secondary" icon={<Plus size={14} />} onClick={() => setShowCreateNode(true)}>
          Node
        </Button>
        <Button variant="secondary" icon={<Plus size={14} />} onClick={() => setShowCreateEdge(true)}>
          Edge
        </Button>
      </div>
      <ReactFlow
        nodes={nodesWithHighlight}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onSelectionChange={onSelectionChange}
        fitView
        className="bg-bg-surface"
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
      </ReactFlow>
      <CreateNodeWizard open={showCreateNode} onClose={() => setShowCreateNode(false)} />
      <CreateEdgeWizard open={showCreateEdge} onClose={() => setShowCreateEdge(false)} />
    </div>
  )
}
