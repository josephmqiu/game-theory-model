import { useEffect, useRef, useCallback } from "react";
import { loadCanvasKit } from "@/canvas/skia/skia-init";
import { SkiaEngine, screenToScene } from "@/canvas/skia/skia-engine";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import { entityToRenderNode } from "@/services/entity/entity-to-pennode";
import { getCanvasBackground } from "@/canvas/canvas-constants";
import { parseColor } from "@/canvas/skia/skia-paint-utils";
import { viewportMatrix } from "@/canvas/skia/skia-viewport";
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
      // Trigger initial render
      engine.markDirty();
    });

    return () => {
      disposed = true;
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

    // Highlight search results by adding glow (handled via custom render)
    const highlightSet = new Set(searchHighlight);

    // Store render nodes on the engine for hit testing
    engine.renderNodes = renderNodes;
    engine.spatialIndex.rebuild(renderNodes);

    // Custom render: draw the entity graph
    const canvas = engine.surface!.getCanvas();
    const ck = engine.ck;
    const dpr = window.devicePixelRatio || 1;

    // Clear
    const bgColor = getCanvasBackground();
    canvas.clear(parseColor(ck, bgColor));

    // Apply viewport transform
    canvas.save();
    canvas.scale(dpr, dpr);
    canvas.concat(
      viewportMatrix({
        zoom: engine.zoom,
        panX: engine.panX,
        panY: engine.panY,
      }),
    );

    // Render entity graph
    engine.renderEntityGraph(
      canvas,
      renderNodes,
      visibleRelationships,
      visibleEntities,
    );

    // Draw search highlight rings
    if (highlightSet.size > 0) {
      for (const rn of renderNodes) {
        if (!highlightSet.has(rn.node.id)) continue;
        const paint = new ck.Paint();
        paint.setStyle(ck.PaintStyle.Stroke);
        paint.setAntiAlias(true);
        paint.setStrokeWidth(2.5);
        paint.setColor(parseColor(ck, "#FBBF24"));
        const rrect = ck.RRectXY(
          ck.LTRBRect(
            rn.absX - 3,
            rn.absY - 3,
            rn.absX + rn.absW + 3,
            rn.absY + rn.absH + 3,
          ),
          8,
          8,
        );
        canvas.drawRRect(rrect, paint);
        paint.delete();
      }
    }

    canvas.restore();
    engine.surface!.flush();
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

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragRef.current.active && dragRef.current.entityId) {
      const engine = engineRef.current;
      const canvas = canvasRef.current;
      if (!engine || !canvas) return;

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

      useEntityGraphStore.getState().pinEntityPosition(
        dragRef.current.entityId,
        dragRef.current.startEntityX + dx,
        dragRef.current.startEntityY + dy,
      );
      return;
    }

    if (!panRef.current.active) return;
    const engine = engineRef.current;
    if (!engine) return;

    const dx = e.clientX - panRef.current.lastX;
    const dy = e.clientY - panRef.current.lastY;
    panRef.current.lastX = e.clientX;
    panRef.current.lastY = e.clientY;

    engine.pan(dx, dy);
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
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

        if (!dragged && hitEntityId) {
          const hit = entities.find((entity) => entity.id === hitEntityId) ?? null;
          onEntitySelect(hit);
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

      // If it was a click (not a drag), perform hit test
      if (!wasDrag) {
        onEntitySelect(getHitEntity(e.clientX, e.clientY));
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

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
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
