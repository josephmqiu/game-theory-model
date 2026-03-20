import { useEffect, useRef, useCallback } from "react";
import { loadCanvasKit } from "@/canvas/skia/skia-init";
import { SkiaEngine, screenToScene } from "@/canvas/skia/skia-engine";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import { layoutEntities } from "@/services/entity/entity-layout";
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
  const panRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
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

    const missingLayoutEntities = visibleEntities.filter((entity) => !layout[entity.id]);
    if (missingLayoutEntities.length > 0) {
      const positions = layoutEntities(visibleEntities);
      const store = useEntityGraphStore.getState();
      const updates = Object.fromEntries(
        Array.from(positions.entries())
          .filter(([id]) => !layout[id])
          .map(([id, position]) => [id, { ...position, pinned: false }]),
      );
      if (Object.keys(updates).length > 0) {
        store.updateLayout(updates);
      }
      return;
    }

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

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only start pan on left button on canvas background (not on entity)
    if (e.button !== 0) return;
    panRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
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
      const wasDrag =
        Math.abs(e.clientX - panRef.current.lastX) > 3 ||
        Math.abs(e.clientY - panRef.current.lastY) > 3;
      panRef.current.active = false;

      // If it was a click (not a drag), perform hit test
      if (!wasDrag) {
        const engine = engineRef.current;
        const canvas = canvasRef.current;
        if (!engine || !canvas) return;

        const rect = canvas.getBoundingClientRect();
        const scene = screenToScene(e.clientX, e.clientY, rect, {
          zoom: engine.zoom,
          panX: engine.panX,
          panY: engine.panY,
        });

        // Hit test: check if the click is within any entity's bounds
        let hit: AnalysisEntity | null = null;
        const visibleEntities = phaseFilter
          ? entities.filter((ent) => ent.phase === phaseFilter)
          : entities;

        for (const entity of visibleEntities) {
          const rn = engine.spatialIndex.get(entity.id);
          if (!rn) continue;
          if (
            scene.x >= rn.absX &&
            scene.x <= rn.absX + rn.absW &&
            scene.y >= rn.absY &&
            scene.y <= rn.absY + rn.absH
          ) {
            hit = entity;
            break;
          }
        }

        onEntitySelect(hit);
      }
    },
    [entities, phaseFilter, onEntitySelect],
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
