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

import { useAppStore } from '../../../store'
import { useExtensiveFormViewModel } from '../../../store/selectors/extensive-form-selectors'
import { coordinationBus } from '../../../coordination'
import { DecisionNode } from '../graph/nodes/DecisionNode'
import { ChanceNode } from '../graph/nodes/ChanceNode'
import { TerminalNode } from '../graph/nodes/TerminalNode'
import { GameEdge } from '../graph/edges/GameEdge'
import { EstimateEditor } from '../../editors/EstimateEditor'
import type { EstimateValue } from '../../../types/estimates'

const nodeTypes: NodeTypes = {
  decision: DecisionNode,
  chance: ChanceNode,
  terminal: TerminalNode,
}

const edgeTypes: EdgeTypes = {
  game: GameEdge,
}

export function TreeView(): ReactNode {
  const canonical = useAppStore((s) => s.canonical)
  const activeFormalizationId = useAppStore((s) => s.viewState.activeFormalizationId)
  const setInspectedRefs = useAppStore((s) => s.setInspectedRefs)
  const dispatch = useAppStore((s) => s.dispatch)

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)

  const viewModel = useMemo(
    () => useExtensiveFormViewModel(canonical, activeFormalizationId),
    [canonical, activeFormalizationId],
  )

  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes }) => {
      const refs = selectedNodes.map((n) => ({
        type: 'game_node' as const,
        id: n.id,
      }))

      setInspectedRefs(refs)

      coordinationBus.emit({
        kind: 'selection_changed',
        source_view: 'tree',
        correlation_id: crypto.randomUUID(),
        refs,
      })
    },
    [setInspectedRefs],
  )

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: { id: string }) => {
      const gameNode = canonical.nodes[node.id]
      if (!gameNode || gameNode.type !== 'terminal' || !gameNode.terminal_payoffs) {
        return
      }

      const firstPlayerId = Object.keys(gameNode.terminal_payoffs)[0]
      if (firstPlayerId) {
        setEditingNodeId(node.id)
        setEditingPlayerId(firstPlayerId)
      }
    },
    [canonical.nodes],
  )

  const handleSavePayoff = useCallback(
    (updated: EstimateValue) => {
      if (!editingNodeId || !editingPlayerId) return

      dispatch({
        kind: 'update_payoff',
        payload: {
          node_id: editingNodeId,
          player_id: editingPlayerId,
          value: updated,
        },
      })

      setEditingNodeId(null)
      setEditingPlayerId(null)
    },
    [editingNodeId, editingPlayerId, dispatch],
  )

  const handleCancelEdit = useCallback(() => {
    setEditingNodeId(null)
    setEditingPlayerId(null)
  }, [])

  if (!viewModel.formalization) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted">
        <div className="text-center">
          <div className="text-lg font-heading mb-2">
            No extensive-form formalization selected
          </div>
          <div className="text-sm">
            Select a game with an extensive-form formalization to view its game tree.
          </div>
        </div>
      </div>
    )
  }

  const editingNode = editingNodeId ? canonical.nodes[editingNodeId] : null
  const editingPayoff =
    editingNode?.terminal_payoffs && editingPlayerId
      ? editingNode.terminal_payoffs[editingPlayerId]
      : null

  return (
    <div className="flex-1 h-full flex flex-col" data-testid="tree-view">
      <div className="flex-1 relative">
        <ReactFlow
          nodes={viewModel.nodes}
          edges={viewModel.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onSelectionChange={onSelectionChange}
          onNodeDoubleClick={handleNodeDoubleClick}
          fitView
          className="bg-bg-surface"
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />

          {/* Information set grouping indicators */}
          {viewModel.informationSets.map((infoSet) => {
            const nodePositions = infoSet.nodeIds
              .map((nid) => viewModel.nodes.find((n) => n.id === nid))
              .filter((n): n is NonNullable<typeof n> => n !== undefined)

            if (nodePositions.length < 2) return null

            const minX = Math.min(...nodePositions.map((n) => n.position.x)) - 20
            const maxX = Math.max(...nodePositions.map((n) => n.position.x)) + 160
            const minY = Math.min(...nodePositions.map((n) => n.position.y)) - 20
            const maxY = Math.max(...nodePositions.map((n) => n.position.y)) + 80

            return (
              <div
                key={infoSet.id}
                className="absolute border-2 border-dashed border-accent rounded-lg pointer-events-none opacity-30"
                style={{
                  left: minX,
                  top: minY,
                  width: maxX - minX,
                  height: maxY - minY,
                }}
              >
                <span className="absolute -top-3 left-2 bg-bg-surface px-1 text-[10px] font-mono text-accent">
                  {infoSet.id}
                </span>
              </div>
            )
          })}
        </ReactFlow>
      </div>

      {editingPayoff && editingPlayerId && (
        <div className="border-t border-border bg-bg-surface p-4 max-h-[300px] overflow-y-auto">
          <div className="max-w-lg mx-auto">
            <div className="text-xs text-text-muted mb-2 font-mono">
              Editing terminal payoff for{' '}
              {canonical.players[editingPlayerId]?.name ?? editingPlayerId}
              {' at '}
              {editingNode?.label ?? editingNodeId}
            </div>
            <EstimateEditor
              existing={editingPayoff}
              onSave={handleSavePayoff}
              onCancel={handleCancelEdit}
            />
          </div>
        </div>
      )}
    </div>
  )
}
