/**
 * Extensive-form game tree — @xyflow/react implementation.
 */

import { useMemo } from "react";
import {
  ReactFlow,
  type Node,
  type Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeTypes,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAnalysisStore } from "@/stores/analysis-store";
import type { Formalization } from "shared/game-theory/types/formalizations";
import type { GameNode, GameEdge } from "shared/game-theory/types";

interface TreeViewProps {
  gameId: string;
  formalizationId: string;
}

function isExtensiveForm(
  f: Formalization,
): f is Extract<Formalization, { kind: "extensive_form" }> {
  return f.kind === "extensive_form";
}

// ── Custom node component ──

function GameTreeNode({
  data,
}: {
  data: { label: string; actor: string; kind: string };
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
      <Handle type="target" position={Position.Top} className="!bg-primary" />
      <p className="text-xs font-medium">{data.label}</p>
      <p className="text-[10px] text-muted-foreground">
        {data.actor} · {data.kind}
      </p>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-primary"
      />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  gameNode: GameTreeNode,
};

// ── Layout helper ──

function layoutTree(
  gameNodes: GameNode[],
  gameEdges: GameEdge[],
  rootNodeId: string | null,
): { nodes: Node[]; edges: Edge[] } {
  const X_GAP = 180;
  const Y_GAP = 100;

  const childMap = new Map<string, GameEdge[]>();
  for (const edge of gameEdges) {
    const children = childMap.get(edge.from) ?? [];
    children.push(edge);
    childMap.set(edge.from, children);
  }

  const nodeMap = new Map(gameNodes.map((n) => [n.id, n]));
  const flowNodes: Node[] = [];
  const flowEdges: Edge[] = [];
  const visited = new Set<string>();

  function walk(nodeId: string, x: number, y: number): number {
    if (visited.has(nodeId)) return 0;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) return 0;

    const children = childMap.get(nodeId) ?? [];
    let subtreeWidth = 0;

    if (children.length === 0) {
      flowNodes.push({
        id: nodeId,
        type: "gameNode",
        position: { x, y },
        data: {
          label: node.label || nodeId.slice(0, 8),
          actor:
            node.actor.kind === "player"
              ? node.actor.player_id
              : node.actor.kind,
          kind: node.type,
        },
      });
      return 1;
    }

    const childWidths: number[] = [];
    let childX = x;
    for (const edge of children) {
      const w = walk(edge.to, childX, y + Y_GAP);
      childWidths.push(w);
      childX += w * X_GAP;
      subtreeWidth += w;

      flowEdges.push({
        id: edge.id,
        source: nodeId,
        target: edge.to,
        label: edge.label || undefined,
        style: { stroke: "var(--border)" },
      });
    }

    const nodeX = x + ((subtreeWidth - 1) * X_GAP) / 2;
    flowNodes.push({
      id: nodeId,
      type: "gameNode",
      position: { x: nodeX, y },
      data: {
        label: node.label || nodeId.slice(0, 8),
        actor:
          node.actor.kind === "player" ? node.actor.player_id : node.actor.kind,
        kind: node.type,
      },
    });

    return subtreeWidth || 1;
  }

  const root = rootNodeId ?? gameNodes[0]?.id;
  if (root) {
    walk(root, 0, 0);
  }

  return { nodes: flowNodes, edges: flowEdges };
}

export function TreeView({ gameId, formalizationId }: TreeViewProps) {
  const game = useAnalysisStore((s) => s.canonical.games[gameId]);
  const formalization = useAnalysisStore(
    (s) => s.canonical.formalizations[formalizationId],
  );
  const allNodes = useAnalysisStore((s) => s.canonical.nodes);
  const allEdges = useAnalysisStore((s) => s.canonical.edges);
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!formalization || !isExtensiveForm(formalization)) {
      return { initialNodes: [], initialEdges: [] };
    }

    const gameNodes = Object.values(allNodes).filter(
      (n) => n.formalization_id === formalizationId,
    );
    const gameEdges = Object.values(allEdges).filter(
      (e) => e.formalization_id === formalizationId,
    );

    const { nodes, edges } = layoutTree(
      gameNodes,
      gameEdges,
      formalization.root_node_id,
    );
    return { initialNodes: nodes, initialEdges: edges };
  }, [formalization, formalizationId, allNodes, allEdges]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  if (!game) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Game not found
      </div>
    );
  }

  if (!formalization || !isExtensiveForm(formalization)) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        No extensive-form formalization available
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        No nodes in this game tree
      </div>
    );
  }

  return (
    <div className="h-[500px] rounded-lg border border-border overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
