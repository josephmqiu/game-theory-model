import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  ViewportPortal,
  type OnSelectionChangeFunc,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus } from 'lucide-react'

import { useAppStore } from '../../../store'
import { selectExtensiveFormViewModel } from '../../../store/selectors/extensive-form-selectors'
import { useCoordinationChannel } from '../../../coordination'
import { DecisionNode } from '../graph/nodes/DecisionNode'
import { ChanceNode } from '../graph/nodes/ChanceNode'
import { TerminalNode } from '../graph/nodes/TerminalNode'
import { GameEdge } from '../graph/edges/GameEdge'
import { EstimateEditor } from '../../editors/EstimateEditor'
import type { EstimateValue } from '../../../types/estimates'
import { EmptyStateNewGame } from '../../shell/EmptyStateNewGame'
import { Button } from '../../design-system'
import { CreateEdgeWizard, CreateNodeWizard } from '../../editors/wizards'

function createEmptyEstimate(): EstimateValue {
  return {
    representation: 'cardinal_estimate',
    value: 0,
    confidence: 0.5,
    rationale: 'Initial analyst estimate.',
    source_claims: [],
  }
}

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
  const activeGameId = useAppStore((s) => s.viewState.activeGameId)
  const setInspectedRefs = useAppStore((s) => s.setInspectedRefs)
  const dispatch = useAppStore((s) => s.dispatch)
  const coordination = useCoordinationChannel('tree')

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [editingError, setEditingError] = useState<string | null>(null)
  const [showCreateNode, setShowCreateNode] = useState(false)
  const [showCreateEdge, setShowCreateEdge] = useState(false)

  const viewModel = useMemo(
    () => selectExtensiveFormViewModel(canonical, activeFormalizationId),
    [canonical, activeFormalizationId],
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
        setEditingError(null)
      } else if (activeGameId) {
        const game = canonical.games[activeGameId]
        const fallbackPlayerId = game?.players[0]
        setEditingNodeId(node.id)
        setEditingPlayerId(fallbackPlayerId ?? null)
        setEditingError(null)
      }
    },
    [canonical.nodes, canonical.games, activeGameId],
  )

  const handleSavePayoff = useCallback(
    (updated: EstimateValue) => {
      if (!editingNodeId || !editingPlayerId) return

      const result = dispatch({
        kind: 'update_payoff',
        payload: {
          node_id: editingNodeId,
          player_id: editingPlayerId,
          value: updated,
        },
      })

      if (result.status === 'committed') {
        setEditingNodeId(null)
        setEditingPlayerId(null)
        setEditingError(null)
      } else if (result.status === 'rejected') {
        setEditingError(result.errors.join('; '))
      }
    },
    [editingNodeId, editingPlayerId, dispatch],
  )

  const handleCancelEdit = useCallback(() => {
    setEditingNodeId(null)
    setEditingPlayerId(null)
    setEditingError(null)
  }, [])

  if (!viewModel.formalization) {
    const activeGame = activeGameId ? canonical.games[activeGameId] : null
    if (activeGame && activeGame.formalizations.length === 0) {
      return <EmptyStateNewGame />
    }

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
  const editablePlayers = activeGameId ? (canonical.games[activeGameId]?.players ?? []) : []
  const editingPayoff =
    editingNode?.terminal_payoffs && editingPlayerId
      ? editingNode.terminal_payoffs[editingPlayerId] ?? null
      : null

  return (
    <div className="flex-1 h-full flex flex-col" data-testid="tree-view">
      <div className="flex-1 relative">
        <div className="absolute right-6 top-6 z-10 flex gap-2">
          <Button variant="secondary" icon={<Plus size={14} />} onClick={() => setShowCreateNode(true)}>
            Node
          </Button>
          <Button variant="secondary" icon={<Plus size={14} />} onClick={() => setShowCreateEdge(true)}>
            Edge
          </Button>
        </div>
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
          <ViewportPortal>
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
          </ViewportPortal>
        </ReactFlow>
      </div>

      {editingNode && editingPlayerId && (
        <div className="border-t border-border bg-bg-surface p-4 max-h-[300px] overflow-y-auto">
          <div className="max-w-lg mx-auto">
            <div className="text-xs text-text-muted mb-2 font-mono">
              Editing terminal payoff for{' '}
              {canonical.players[editingPlayerId]?.name ?? editingPlayerId}
              {' at '}
              {editingNode?.label ?? editingNodeId}
            </div>
            {editablePlayers.length > 0 && (
              <select
                value={editingPlayerId}
                onChange={(event) => setEditingPlayerId(event.target.value)}
                className="mb-3 w-full rounded border border-border bg-bg-card px-3 py-2 font-mono text-xs text-text-primary focus:outline-none focus:border-accent"
              >
                {editablePlayers.map((playerId) => (
                  <option key={playerId} value={playerId}>
                    {canonical.players[playerId]?.name ?? playerId}
                  </option>
                ))}
              </select>
            )}
            {editingError && (
              <div className="mb-2 font-mono text-xs text-warning">{editingError}</div>
            )}
            <EstimateEditor
              existing={editingPayoff ?? createEmptyEstimate()}
              onSave={handleSavePayoff}
              onCancel={handleCancelEdit}
            />
          </div>
        </div>
      )}
      <CreateNodeWizard open={showCreateNode} onClose={() => setShowCreateNode(false)} />
      <CreateEdgeWizard open={showCreateEdge} onClose={() => setShowCreateEdge(false)} />
    </div>
  )
}
