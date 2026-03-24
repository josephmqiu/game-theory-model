import { useEffect, useRef, useCallback } from "react";
import { loadCanvasKit } from "@/canvas/skia/skia-init";
import { SkiaEngine, screenToScene } from "@/canvas/skia/skia-engine";
import { setSkiaEngineRef } from "@/canvas/skia-engine-ref";
import { useCanvasStore } from "@/stores/canvas-store";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import { entityToRenderNode } from "@/services/entity/entity-to-pennode";
import { routeEdges } from "@/services/entity/edge-routing";
import { bundleEdges } from "@/services/entity/edge-bundling";
import type { EntityRect } from "@/services/entity/edge-routing";
import { getEntityCardMetrics } from "@/services/entity/entity-card-metrics";
import type { AnalysisEntity } from "@/types/entity";
import type { MethodologyPhase } from "@/types/methodology";

// ── Props ──

export interface AnalysisCanvasProps {
  onEntitySelect: (entity: AnalysisEntity | null) => void;
  phaseFilter: MethodologyPhase | null;
  searchHighlight: string[];
}

// ── Component ──

export default function AnalysisCanvas({
  onEntitySelect,
  phaseFilter,
  searchHighlight,
}: AnalysisCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SkiaEngine | null>(null);
  const panRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
  });
  const dragRef = useRef<{
    active: boolean;
    entityId: string | null;
    startClientX: number;
    startClientY: number;
    startSceneX: number;
    startSceneY: number;
    startEntityX: number;
    startEntityY: number;
    moved: boolean;
  }>({
    active: false,
    entityId: null,
    startClientX: 0,
    startClientY: 0,
    startSceneX: 0,
    startSceneY: 0,
    startEntityX: 0,
    startEntityY: 0,
    moved: false,
  });

  // Track entity graph revision to trigger re-renders
  const revision = useEntityGraphStore((s) => s.revision);
  const entities = useEntityGraphStore((s) => s.analysis.entities);
  const relationships = useEntityGraphStore((s) => s.analysis.relationships);
  const layout = useEntityGraphStore((s) => s.layout);

  // ── Initialize Skia engine ──

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;

    loadCanvasKit().then((ck) => {
      if (disposed) return;
      const engine = new SkiaEngine(ck);
      engine.init(canvas);
      engineRef.current = engine;
      setSkiaEngineRef(engine);
      // Trigger initial render
      engine.markDirty();
    });

    return () => {
      disposed = true;
      setSkiaEngineRef(null);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  // ── Resize observer ──

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      engineRef.current?.resize(width, height);
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ── Render entity graph when data changes ──

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !engine.surface) return;

    // Filter entities by phase if a phase filter is active
    const visibleEntities = phaseFilter
      ? entities.filter((e) => e.phase === phaseFilter)
      : entities;

    // Build render nodes
    const renderNodes = visibleEntities
      .map((entity) => {
        const layoutEntry = layout[entity.id];
        return layoutEntry ? entityToRenderNode(entity, layoutEntry) : null;
      })
      .filter((node): node is NonNullable<typeof node> => node !== null);

    // Filter relationships to visible entities
    const visibleIds = new Set(visibleEntities.map((e) => e.id));
    const visibleRelationships = relationships.filter(
      (r) => visibleIds.has(r.fromEntityId) && visibleIds.has(r.toEntityId),
    );

    // Build EntityRects for edge routing
    const entityRects: EntityRect[] = [];
    for (const entity of visibleEntities) {
      const layoutEntry = layout[entity.id];
      if (!layoutEntry) continue;
      const metrics = getEntityCardMetrics(entity.type);
      entityRects.push({
        id: entity.id,
        x: layoutEntry.x,
        y: layoutEntry.y,
        w: metrics.width,
        h: metrics.height,
        phase: entity.phase,
      });
    }

    // Route edges through inter-column channels, then bundle parallel edges
    const routed = routeEdges(entityRects, visibleRelationships);
    const bundled = bundleEdges(routed);

    // Store render data on the engine — the render loop handles drawing
    engine.renderNodes = renderNodes;
    engine.spatialIndex.rebuild(renderNodes);
    engine.entityMap.clear();
    for (const e of visibleEntities) engine.entityMap.set(e.id, e);
    engine.entityRelationships = visibleRelationships;
    engine.routedEdges = bundled;
    engine.searchHighlightIds = new Set(searchHighlight);

    engine.markDirty();
  }, [revision, entities, relationships, layout, phaseFilter, searchHighlight]);

  // ── Pan (mouse drag) ──

  const getHitEntity = useCallback(
    (clientX: number, clientY: number): AnalysisEntity | null => {
      const engine = engineRef.current;
      const canvas = canvasRef.current;
      if (!engine || !canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const scene = screenToScene(clientX, clientY, rect, {
        zoom: engine.zoom,
        panX: engine.panX,
        panY: engine.panY,
      });

      const visibleEntities = phaseFilter
        ? entities.filter((entity) => entity.phase === phaseFilter)
        : entities;

      for (const entity of visibleEntities) {
        const renderNode = engine.spatialIndex.get(entity.id);
        if (!renderNode) continue;
        if (
          scene.x >= renderNode.absX &&
          scene.x <= renderNode.absX + renderNode.absW &&
          scene.y >= renderNode.absY &&
          scene.y <= renderNode.absY + renderNode.absH
        ) {
          return entity;
        }
      }

      return null;
    },
    [entities, phaseFilter],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;

      const hitEntity = getHitEntity(e.clientX, e.clientY);
      if (hitEntity) {
        const engine = engineRef.current;
        const canvas = canvasRef.current;
        const layoutEntry = layout[hitEntity.id];
        if (!engine || !canvas || !layoutEntry) return;

        const rect = canvas.getBoundingClientRect();
        const scene = screenToScene(e.clientX, e.clientY, rect, {
          zoom: engine.zoom,
          panX: engine.panX,
          panY: engine.panY,
        });

        dragRef.current = {
          active: true,
          entityId: hitEntity.id,
          startClientX: e.clientX,
          startClientY: e.clientY,
          startSceneX: scene.x,
          startSceneY: scene.y,
          startEntityX: layoutEntry.x,
          startEntityY: layoutEntry.y,
          moved: false,
        };
      } else {
        panRef.current = {
          active: true,
          startX: e.clientX,
          startY: e.clientY,
          lastX: e.clientX,
          lastY: e.clientY,
        };
      }

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [getHitEntity, layout],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragRef.current.active && dragRef.current.entityId) {
        const engine = engineRef.current;
        const canvas = canvasRef.current;
        if (!engine || !canvas) return;

        // Set grabbing cursor during drag
        canvas.style.cursor = "grabbing";

        const rect = canvas.getBoundingClientRect();
        const scene = screenToScene(e.clientX, e.clientY, rect, {
          zoom: engine.zoom,
          panX: engine.panX,
          panY: engine.panY,
        });
        const dx = scene.x - dragRef.current.startSceneX;
        const dy = scene.y - dragRef.current.startSceneY;
        const movedEnough =
          Math.abs(e.clientX - dragRef.current.startClientX) > 3 ||
          Math.abs(e.clientY - dragRef.current.startClientY) > 3;

        if (movedEnough) {
          dragRef.current.moved = true;
        }

        useEntityGraphStore
          .getState()
          .pinEntityPosition(
            dragRef.current.entityId,
            dragRef.current.startEntityX + dx,
            dragRef.current.startEntityY + dy,
          );
        return;
      }

      if (panRef.current.active) {
        const engine = engineRef.current;
        const canvas = canvasRef.current;
        if (!engine) return;

        // Set grabbing cursor during pan
        if (canvas) canvas.style.cursor = "grabbing";

        const dx = e.clientX - panRef.current.lastX;
        const dy = e.clientY - panRef.current.lastY;
        panRef.current.lastX = e.clientX;
        panRef.current.lastY = e.clientY;

        engine.pan(dx, dy);
        return;
      }

      // ── Hover detection (only when not dragging/panning) ──
      const hitEntity = getHitEntity(e.clientX, e.clientY);
      const engine = engineRef.current;
      const canvas = canvasRef.current;
      if (engine && canvas) {
        const newHoveredId = hitEntity?.id ?? null;
        if (engine.hoveredEntityId !== newHoveredId) {
          engine.hoveredEntityId = newHoveredId;
          engine.markDirty();
        }

        // Always track mouse position in scene coords (for tooltip positioning)
        const rect = canvas.getBoundingClientRect();
        const scene = screenToScene(e.clientX, e.clientY, rect, {
          zoom: engine.zoom,
          panX: engine.panX,
          panY: engine.panY,
        });
        engine.lastMouseSceneX = scene.x;
        engine.lastMouseSceneY = scene.y;

        if (!newHoveredId) {
          // No entity hit — check for edge hit
          const edgeIdx = engine.hitTestEdge(scene.x, scene.y);
          if (engine.hoveredEdgeIndex !== edgeIdx) {
            engine.hoveredEdgeIndex = edgeIdx;
            engine.markDirty();
          }
          canvas.style.cursor = edgeIdx >= 0 ? "pointer" : "default";
        } else {
          // Entity was hit — clear edge hover
          if (engine.hoveredEdgeIndex !== -1) {
            engine.hoveredEdgeIndex = -1;
            engine.markDirty();
          }
          canvas.style.cursor = "pointer";
        }
      }
    },
    [getHitEntity],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      // Restore cursor from grabbing state
      const canvas = canvasRef.current;

      if (dragRef.current.active) {
        const hitEntityId = dragRef.current.entityId;
        const dragged = dragRef.current.moved;
        dragRef.current = {
          active: false,
          entityId: null,
          startClientX: 0,
          startClientY: 0,
          startSceneX: 0,
          startSceneY: 0,
          startEntityX: 0,
          startEntityY: 0,
          moved: false,
        };

        // Restore cursor: pointer if still over entity, default otherwise
        if (canvas) {
          canvas.style.cursor = hitEntityId ? "pointer" : "default";
        }

        if (!dragged && hitEntityId) {
          const hit =
            entities.find((entity) => entity.id === hitEntityId) ?? null;
          onEntitySelect(hit);
          useCanvasStore.getState().setFocusedEntityId(hitEntityId);
        }

        return;
      }

      const wasDrag =
        Math.abs(e.clientX - panRef.current.startX) > 3 ||
        Math.abs(e.clientY - panRef.current.startY) > 3;
      panRef.current = {
        active: false,
        startX: 0,
        startY: 0,
        lastX: 0,
        lastY: 0,
      };

      // Restore cursor from pan
      if (canvas) canvas.style.cursor = "default";

      // If it was a click (not a drag), perform hit test
      if (!wasDrag) {
        const hitEntity = getHitEntity(e.clientX, e.clientY);
        onEntitySelect(hitEntity);
        useCanvasStore.getState().setFocusedEntityId(hitEntity?.id ?? null);
      }
    },
    [entities, getHitEntity, onEntitySelect],
  );

  // ── Zoom (wheel) ──

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const engine = engineRef.current;
    if (!engine) return;

    const delta = -e.deltaY * 0.001;
    const newZoom = engine.zoom * (1 + delta);
    engine.zoomToPoint(e.clientX, e.clientY, newZoom);
  }, []);

  // ── Escape to clear focus ──

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      useCanvasStore.getState().setFocusedEntityId(null);
      if (engineRef.current) {
        engineRef.current.hoveredEntityId = null;
        engineRef.current.hoveredEdgeIndex = -1;
        engineRef.current.markDirty();
      }
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      />
    </div>
  );
}
