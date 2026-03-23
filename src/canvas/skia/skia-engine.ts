import type { CanvasKit, Canvas, Surface } from "canvaskit-wasm";
import type { PenNode, ContainerProps, EllipseNode } from "@/types/pen";
import type {
  AnalysisEntity,
  AnalysisRelationship,
  EntityType,
  RelationshipType,
} from "@/types/entity";
import { RELATIONSHIP_CATEGORY } from "@/types/entity";
import type { RoutedEdge } from "@/services/entity/edge-routing";
import { useCanvasStore } from "@/stores/canvas-store";
import {
  useDocumentStore,
  getActivePageChildren,
  getAllChildren,
} from "@/stores/document-store";
import {
  resolveNodeForCanvas,
  getDefaultTheme,
} from "@/variables/resolve-variables";
import { getCanvasBackground, MIN_ZOOM, MAX_ZOOM } from "../canvas-constants";
import {
  resolvePadding,
  isNodeVisible,
  getNodeWidth,
  getNodeHeight,
  computeLayoutPositions,
  inferLayout,
} from "../canvas-layout-engine";
import { parseSizing, defaultLineHeight } from "../canvas-text-measure";
import { SkiaRenderer, type RenderNode } from "./skia-renderer";
import { SpatialIndex } from "./skia-hit-test";
import { parseColor, wrapLine, cssFontFamily } from "./skia-paint-utils";
import { viewportMatrix, zoomToPoint as vpZoomToPoint } from "./skia-viewport";
import { shouldDrawFrameLabel } from "./frame-label-utils";
import {
  getActiveAgentIndicators,
  getActiveAgentFrames,
  isPreviewNode,
} from "../agent-indicator";
// Design-animation stubs: the animation map is only populated by the design
// orchestrator (unreachable from the analysis app), so these are always no-ops.
const isNodeBorderReady = (_id: string): boolean => false;
const getNodeRevealTime = (_id: string): number | undefined => undefined;

// Re-export for use by canvas component
export { screenToScene } from "./skia-viewport";
export { SpatialIndex } from "./skia-hit-test";

// ---------------------------------------------------------------------------
// Pre-measure text widths using Canvas 2D (browser fonts)
// ---------------------------------------------------------------------------

let _measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx(): CanvasRenderingContext2D {
  if (!_measureCtx) {
    const c = document.createElement("canvas");
    _measureCtx = c.getContext("2d")!;
  }
  return _measureCtx;
}

/**
 * Walk the node tree and fix text HEIGHTS using actual Canvas 2D wrapping.
 *
 * Only targets fixed-width text with auto height — these are the cases where
 * estimateTextHeight may underestimate because its width estimation differs
 * from Canvas 2D's actual text measurement, leading to incorrect wrap counts.
 *
 * IMPORTANT: This function never touches WIDTH or container-relative sizing
 * strings (fill_container / fit_content). Changing widths breaks layout
 * resolution in computeLayoutPositions.
 */
function premeasureTextHeights(nodes: PenNode[]): PenNode[] {
  return nodes.map((node) => {
    let result = node;

    if (node.type === "text") {
      const tNode = node as import("@/types/pen").TextNode;
      const hasFixedWidth = typeof tNode.width === "number" && tNode.width > 0;
      const isContainerHeight =
        typeof tNode.height === "string" &&
        (tNode.height === "fill_container" || tNode.height === "fit_content");
      const textGrowth = tNode.textGrowth;
      const content =
        typeof tNode.content === "string"
          ? tNode.content
          : Array.isArray(tNode.content)
            ? tNode.content.map((s) => s.text ?? "").join("")
            : "";

      // Match Fabric.js wrapping: only premeasure when text actually wraps.
      // textGrowth='auto' means auto-width (no wrapping) regardless of textAlign.
      // textGrowth=undefined with non-left textAlign uses fixed-width for alignment.
      const textAlign = tNode.textAlign;
      const isFixedWidthText =
        textGrowth === "fixed-width" ||
        textGrowth === "fixed-width-height" ||
        (textGrowth !== "auto" && textAlign != null && textAlign !== "left");
      if (content && hasFixedWidth && isFixedWidthText && !isContainerHeight) {
        const fontSize = tNode.fontSize ?? 16;
        const fontWeight = tNode.fontWeight ?? "400";
        const fontFamily =
          tNode.fontFamily ??
          'Inter, -apple-system, "Noto Sans SC", "PingFang SC", system-ui, sans-serif';
        const ctx = getMeasureCtx();
        ctx.font = `${fontWeight} ${fontSize}px ${cssFontFamily(fontFamily)}`;

        // Fixed-width text with auto height: wrap and measure actual height
        const wrapWidth = (tNode.width as number) + fontSize * 0.2;
        const rawLines = content.split("\n");
        const wrappedLines: string[] = [];
        for (const raw of rawLines) {
          if (!raw) {
            wrappedLines.push("");
            continue;
          }
          wrapLine(ctx, raw, wrapWidth, wrappedLines);
        }
        const lineHeightMul = tNode.lineHeight ?? defaultLineHeight(fontSize);
        const lineHeight = lineHeightMul * fontSize;
        const glyphH = fontSize * 1.13;
        const measuredHeight = Math.ceil(
          wrappedLines.length <= 1
            ? glyphH + 2
            : (wrappedLines.length - 1) * lineHeight + glyphH + 2,
        );
        const currentHeight =
          typeof tNode.height === "number" ? tNode.height : 0;
        const explicitLineCount = rawLines.length;
        const needsHeight =
          currentHeight <= 0 || wrappedLines.length > explicitLineCount;
        if (needsHeight && measuredHeight > currentHeight) {
          result = { ...node, height: measuredHeight } as unknown as PenNode;
        }
      }
    }

    // Recurse into children
    if ("children" in result && result.children) {
      const children = result.children;
      const measured = premeasureTextHeights(children);
      if (measured !== children) {
        result = { ...result, children: measured } as unknown as PenNode;
      }
    }

    return result;
  });
}

// ---------------------------------------------------------------------------
// Flatten document tree → absolute-positioned RenderNode list
// ---------------------------------------------------------------------------

interface ClipInfo {
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
}

function sizeToNumber(
  val: number | string | undefined,
  fallback: number,
): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const m = val.match(/\((\d+(?:\.\d+)?)\)/);
    if (m) return parseFloat(m[1]);
    const n = parseFloat(val);
    if (!isNaN(n)) return n;
  }
  return fallback;
}

function cornerRadiusVal(
  cr: number | [number, number, number, number] | undefined,
): number {
  if (cr === undefined) return 0;
  if (typeof cr === "number") return cr;
  return cr[0];
}

/** Resolve RefNodes inline (same logic as use-canvas-sync.ts). */
function resolveRefs(
  nodes: PenNode[],
  rootNodes: PenNode[],
  findInTree: (nodes: PenNode[], id: string) => PenNode | null,
  visited = new Set<string>(),
): PenNode[] {
  return nodes.flatMap((node) => {
    if (node.type !== "ref") {
      if ("children" in node && node.children) {
        return [
          {
            ...node,
            children: resolveRefs(
              node.children,
              rootNodes,
              findInTree,
              visited,
            ),
          } as PenNode,
        ];
      }
      return [node];
    }
    if (visited.has(node.ref)) return [];
    const component = findInTree(rootNodes, node.ref);
    if (!component) return [];
    visited.add(node.ref);
    const resolved: Record<string, unknown> = { ...component };
    for (const [key, val] of Object.entries(node)) {
      if (
        key === "type" ||
        key === "ref" ||
        key === "descendants" ||
        key === "children"
      )
        continue;
      if (val !== undefined) resolved[key] = val;
    }
    resolved.type = component.type;
    if (!resolved.name) resolved.name = component.name;
    delete resolved.reusable;
    const resolvedNode = resolved as unknown as PenNode;
    if ("children" in component && component.children) {
      const refNode = node as import("@/types/pen").RefNode;
      (resolvedNode as PenNode & ContainerProps).children = remapIds(
        component.children,
        node.id,
        refNode.descendants,
      );
    }
    visited.delete(node.ref);
    return [resolvedNode];
  });
}

function remapIds(
  children: PenNode[],
  refId: string,
  overrides?: Record<string, Partial<PenNode>>,
): PenNode[] {
  return children.map((child) => {
    const virtualId = `${refId}__${child.id}`;
    const ov = overrides?.[child.id] ?? {};
    const mapped = { ...child, ...ov, id: virtualId } as PenNode;
    if ("children" in mapped && mapped.children) {
      (mapped as PenNode & ContainerProps).children = remapIds(
        mapped.children,
        refId,
        overrides,
      );
    }
    return mapped;
  });
}

export function flattenToRenderNodes(
  nodes: PenNode[],
  offsetX = 0,
  offsetY = 0,
  parentAvailW?: number,
  parentAvailH?: number,
  clipCtx?: ClipInfo,
  depth = 0,
): RenderNode[] {
  const result: RenderNode[] = [];

  // Reverse order: children[0] = top layer = rendered last (frontmost)
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    if (!isNodeVisible(node)) continue;

    // Resolve fill_container / fit_content
    let resolved = node;
    if (parentAvailW !== undefined || parentAvailH !== undefined) {
      let changed = false;
      const r: Record<string, unknown> = { ...node };
      if ("width" in node && typeof node.width !== "number") {
        const s = parseSizing(node.width);
        if (s === "fill" && parentAvailW) {
          r.width = parentAvailW;
          changed = true;
        } else if (s === "fit") {
          r.width = getNodeWidth(node, parentAvailW);
          changed = true;
        }
      }
      if ("height" in node && typeof node.height !== "number") {
        const s = parseSizing(node.height);
        if (s === "fill" && parentAvailH) {
          r.height = parentAvailH;
          changed = true;
        } else if (s === "fit") {
          r.height = getNodeHeight(node, parentAvailH, parentAvailW);
          changed = true;
        }
      }
      if (changed) resolved = r as unknown as PenNode;
    }

    // Compute height for frames without explicit numeric height
    if (
      node.type === "frame" &&
      "children" in node &&
      node.children?.length &&
      (!("height" in resolved) || typeof resolved.height !== "number")
    ) {
      const computedH = getNodeHeight(resolved, parentAvailH, parentAvailW);
      if (computedH > 0)
        resolved = { ...resolved, height: computedH } as unknown as PenNode;
    }

    const absX = (resolved.x ?? 0) + offsetX;
    const absY = (resolved.y ?? 0) + offsetY;
    const absW = "width" in resolved ? sizeToNumber(resolved.width, 100) : 100;
    const absH =
      "height" in resolved ? sizeToNumber(resolved.height, 100) : 100;

    result.push({
      node: { ...resolved, x: absX, y: absY } as PenNode,
      absX,
      absY,
      absW,
      absH,
      clipRect: clipCtx,
    });

    // Recurse into children
    const children = "children" in node ? node.children : undefined;
    if (children && children.length > 0) {
      const nodeW = getNodeWidth(resolved, parentAvailW);
      const nodeH = getNodeHeight(resolved, parentAvailH, parentAvailW);
      const pad = resolvePadding(
        "padding" in resolved
          ? (resolved as PenNode & ContainerProps).padding
          : undefined,
      );
      const childAvailW = Math.max(0, nodeW - pad.left - pad.right);
      const childAvailH = Math.max(0, nodeH - pad.top - pad.bottom);

      const layout =
        ("layout" in node ? (node as ContainerProps).layout : undefined) ||
        inferLayout(node);
      const positioned =
        layout && layout !== "none"
          ? computeLayoutPositions(resolved, children)
          : children;

      // Clipping — only clip for root frames (artboard behavior).
      // Nested frames do NOT clip children, matching Fabric.js behavior.
      // Fabric.js doesn't implement frame-level clipping, so children always overflow.
      // TODO: add proper clipContent support once Fabric.js is fully replaced.
      let childClip = clipCtx;
      const isRootFrame = node.type === "frame" && depth === 0;
      if (isRootFrame) {
        const crRaw =
          "cornerRadius" in node ? cornerRadiusVal(node.cornerRadius) : 0;
        const cr = Math.min(crRaw, nodeH / 2);
        childClip = { x: absX, y: absY, w: nodeW, h: nodeH, rx: cr };
      }

      const childRNs = flattenToRenderNodes(
        positioned,
        absX,
        absY,
        childAvailW,
        childAvailH,
        childClip,
        depth + 1,
      );

      // Propagate parent flip to children: mirror positions within parent bounds
      // and toggle child flipX/flipY. Must run BEFORE rotation propagation.
      const parentFlipX = node.flipX === true;
      const parentFlipY = node.flipY === true;
      if (parentFlipX || parentFlipY) {
        const pcx = absX + nodeW / 2;
        const pcy = absY + nodeH / 2;
        for (const crn of childRNs) {
          const updates: Record<string, unknown> = {};
          if (parentFlipX) {
            const ccx = crn.absX + crn.absW / 2;
            crn.absX = 2 * pcx - ccx - crn.absW / 2;
            const childFlip = crn.node.flipX === true;
            updates.flipX = !childFlip || undefined;
          }
          if (parentFlipY) {
            const ccy = crn.absY + crn.absH / 2;
            crn.absY = 2 * pcy - ccy - crn.absH / 2;
            const childFlip = crn.node.flipY === true;
            updates.flipY = !childFlip || undefined;
          }
          crn.node = {
            ...crn.node,
            x: crn.absX,
            y: crn.absY,
            ...updates,
          } as PenNode;
        }
      }

      // Propagate parent rotation to children: rotate their positions around
      // the parent's center and accumulate the rotation angle.
      // Children are in the parent's LOCAL (unrotated) coordinate space, so we
      // need to apply the parent's rotation to get correct absolute positions.
      const parentRot = node.rotation ?? 0;
      if (parentRot !== 0) {
        const cx = absX + nodeW / 2;
        const cy = absY + nodeH / 2;
        const rad = (parentRot * Math.PI) / 180;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);

        for (const crn of childRNs) {
          // Rotate child CENTER around parent center
          const ccx = crn.absX + crn.absW / 2;
          const ccy = crn.absY + crn.absH / 2;
          const dx = ccx - cx;
          const dy = ccy - cy;
          const newCx = cx + dx * cosA - dy * sinA;
          const newCy = cy + dx * sinA + dy * cosA;
          crn.absX = newCx - crn.absW / 2;
          crn.absY = newCy - crn.absH / 2;
          // Accumulate rotation and update node position
          const childRot = crn.node.rotation ?? 0;
          crn.node = {
            ...crn.node,
            x: crn.absX,
            y: crn.absY,
            rotation: childRot + parentRot,
          } as PenNode;
        }
      }

      result.push(...childRNs);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Component / instance ID collection (from raw tree, before ref resolution)
// ---------------------------------------------------------------------------

function collectReusableIds(nodes: PenNode[], result: Set<string>) {
  for (const node of nodes) {
    if (node.type === "frame" && node.reusable === true) {
      result.add(node.id);
    }
    if ("children" in node && node.children) {
      collectReusableIds(node.children, result);
    }
  }
}

function collectInstanceIds(nodes: PenNode[], result: Set<string>) {
  for (const node of nodes) {
    if (node.type === "ref") {
      result.add(node.id);
    }
    if ("children" in node && node.children) {
      collectInstanceIds(node.children, result);
    }
  }
}

// ---------------------------------------------------------------------------
// SkiaEngine — ties rendering, viewport, hit testing together
// ---------------------------------------------------------------------------

export class SkiaEngine {
  ck: CanvasKit;
  surface: Surface | null = null;
  renderer: SkiaRenderer;
  spatialIndex = new SpatialIndex();
  renderNodes: RenderNode[] = [];

  // Entity graph data (set by analysis-canvas, consumed by render loop)
  entityMap = new Map<string, AnalysisEntity>();
  entityRelationships: AnalysisRelationship[] = [];
  routedEdges: RoutedEdge[] = [];
  searchHighlightIds = new Set<string>();

  // Component/instance IDs for colored frame labels
  private reusableIds = new Set<string>();
  private instanceIds = new Set<string>();

  // Agent animation: track start time so glow only pulses ~2 times
  private agentAnimStart = 0;

  private canvasEl: HTMLCanvasElement | null = null;
  private animFrameId = 0;
  private dirty = true;

  // Viewport
  zoom = 1;
  panX = 0;
  panY = 0;

  // Drag suppression — prevents syncFromDocument during drag
  // so the layout engine doesn't override visual positions
  dragSyncSuppressed = false;

  // Interaction state
  hoveredNodeId: string | null = null;
  marquee: { x1: number; y1: number; x2: number; y2: number } | null = null;
  previewShape: {
    type: "rectangle" | "ellipse" | "frame" | "line" | "polygon";
    x: number;
    y: number;
    w: number;
    h: number;
  } | null = null;
  penPreview: import("./skia-overlays").PenPreviewData | null = null;

  constructor(ck: CanvasKit) {
    this.ck = ck;
    this.renderer = new SkiaRenderer(ck);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  init(canvasEl: HTMLCanvasElement) {
    this.canvasEl = canvasEl;
    const dpr = window.devicePixelRatio || 1;
    canvasEl.width = canvasEl.clientWidth * dpr;
    canvasEl.height = canvasEl.clientHeight * dpr;

    this.surface = this.ck.MakeWebGLCanvasSurface(canvasEl);
    if (!this.surface) {
      // Fallback to software
      this.surface = this.ck.MakeSWCanvasSurface(canvasEl);
    }
    if (!this.surface) {
      console.error("SkiaEngine: Failed to create surface");
      return;
    }

    this.renderer.init();
    this.renderer.setRedrawCallback(() => this.markDirty());
    // Re-render when async font loading completes
    (this.renderer as any)._onFontLoaded = () => this.markDirty();
    // Pre-load default fonts for vector text rendering.
    // Noto Sans SC is loaded alongside Inter so CJK glyphs are always available
    // in the fallback chain — system CJK fonts (PingFang SC, Microsoft YaHei, etc.)
    // are skipped from Google Fonts, and without Noto Sans SC the fallback chain
    // would only contain Inter which has no CJK coverage, causing tofu.
    this.renderer.fontManager.ensureFont("Inter").then(() => this.markDirty());
    this.renderer.fontManager
      .ensureFont("Noto Sans SC")
      .then(() => this.markDirty());
    this.startRenderLoop();
  }

  dispose() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.renderer.dispose();
    this.surface?.delete();
    this.surface = null;
  }

  resize(width: number, height: number) {
    if (!this.canvasEl) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvasEl.width = width * dpr;
    this.canvasEl.height = height * dpr;

    // Recreate surface
    this.surface?.delete();
    this.surface = this.ck.MakeWebGLCanvasSurface(this.canvasEl);
    if (!this.surface) {
      this.surface = this.ck.MakeSWCanvasSurface(this.canvasEl);
    }
    this.markDirty();
  }

  // ---------------------------------------------------------------------------
  // Document sync
  // ---------------------------------------------------------------------------

  syncFromDocument() {
    if (this.dragSyncSuppressed) return;
    const docState = useDocumentStore.getState();
    const activePageId = useCanvasStore.getState().activePageId;
    const pageChildren = getActivePageChildren(docState.document, activePageId);
    const allNodes = getAllChildren(docState.document);

    // Simple findNodeInTree
    const findInTree = (nodes: PenNode[], id: string): PenNode | null => {
      for (const n of nodes) {
        if (n.id === id) return n;
        if ("children" in n && n.children) {
          const found = findInTree(n.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    // Collect reusable/instance IDs from raw tree (before ref resolution strips them)
    this.reusableIds.clear();
    this.instanceIds.clear();
    collectReusableIds(pageChildren, this.reusableIds);
    collectInstanceIds(pageChildren, this.instanceIds);

    // Resolve refs, variables, then flatten
    const resolved = resolveRefs(pageChildren, allNodes, findInTree);

    // Resolve design variables
    const variables = docState.document.variables ?? {};
    const themes = docState.document.themes;
    const defaultTheme = getDefaultTheme(themes);
    const variableResolved = resolved.map((n) =>
      resolveNodeForCanvas(n, variables, defaultTheme),
    );

    // Only premeasure text HEIGHTS for fixed-width text (where wrapping
    // estimation may differ from Canvas 2D). Never touch widths or
    // container-relative sizing to maintain layout consistency with Fabric.js.
    const measured = premeasureTextHeights(variableResolved);

    this.renderNodes = flattenToRenderNodes(measured);

    this.spatialIndex.rebuild(this.renderNodes);
    this.markDirty();
  }

  // ---------------------------------------------------------------------------
  // Render loop
  // ---------------------------------------------------------------------------

  markDirty() {
    this.dirty = true;
  }

  private startRenderLoop() {
    const loop = () => {
      this.animFrameId = requestAnimationFrame(loop);
      if (!this.dirty || !this.surface) return;
      this.dirty = false;
      this.render();
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  private render() {
    if (!this.surface || !this.canvasEl) return;
    const canvas = this.surface.getCanvas();
    const ck = this.ck;

    const dpr = window.devicePixelRatio || 1;
    const selectedIds = new Set(
      useCanvasStore.getState().selection.selectedIds,
    );

    // Clear
    const bgColor = getCanvasBackground();
    canvas.clear(parseColor(ck, bgColor));

    // Apply viewport transform
    canvas.save();
    canvas.scale(dpr, dpr);
    canvas.concat(
      viewportMatrix({ zoom: this.zoom, panX: this.panX, panY: this.panY }),
    );

    // Pass current zoom to renderer for zoom-aware text rasterization
    this.renderer.zoom = this.zoom;

    // Draw relationship edges (behind entity nodes)
    if (this.entityMap.size > 0) {
      if (this.routedEdges.length > 0) {
        // ── Draw routed edges in 3 passes: structural (back) → evidence → downstream (front) ──
        const routedByCategory: Record<string, RoutedEdge[]> = {
          structural: [],
          evidence: [],
          downstream: [],
        };
        for (const edge of this.routedEdges) {
          routedByCategory[edge.category].push(edge);
        }
        for (const category of [
          "structural",
          "evidence",
          "downstream",
        ] as const) {
          for (const edge of routedByCategory[category]) {
            this.drawRoutedEdge(canvas, edge);
          }
        }
      } else {
        // Fallback to old center-to-center drawing if no routed edges
        const posMap = new Map<string, { cx: number; cy: number }>();
        for (const rn of this.renderNodes) {
          if (
            typeof rn.node.role === "string" &&
            rn.node.role.startsWith("entity-")
          ) {
            posMap.set(rn.node.id, {
              cx: rn.absX + rn.absW / 2,
              cy: rn.absY + rn.absH / 2,
            });
          }
        }
        const edgesByCategory: Record<string, typeof this.entityRelationships> =
          {
            structural: [],
            evidence: [],
            downstream: [],
          };
        for (const rel of this.entityRelationships) {
          const cat = RELATIONSHIP_CATEGORY[rel.type] ?? "structural";
          edgesByCategory[cat].push(rel);
        }
        for (const category of [
          "structural",
          "evidence",
          "downstream",
        ] as const) {
          for (const rel of edgesByCategory[category]) {
            const from = posMap.get(rel.fromEntityId);
            const to = posMap.get(rel.toEntityId);
            if (from && to)
              this.drawRelationshipEdge(canvas, from, to, rel.type);
          }
        }
      }
    }

    // Draw all render nodes (entity nodes use custom renderer, others use generic)
    for (const rn of this.renderNodes) {
      if (
        typeof rn.node.role === "string" &&
        rn.node.role.startsWith("entity-")
      ) {
        const entity = this.entityMap.get(rn.node.id);
        this.drawEntityNode(canvas, rn, entity);
      } else {
        this.renderer.drawNode(canvas, rn, selectedIds);
      }
    }

    // Draw search highlight rings on matched entity nodes
    if (this.searchHighlightIds.size > 0) {
      for (const rn of this.renderNodes) {
        if (!this.searchHighlightIds.has(rn.node.id)) continue;
        const hlPaint = new ck.Paint();
        hlPaint.setStyle(ck.PaintStyle.Stroke);
        hlPaint.setAntiAlias(true);
        hlPaint.setStrokeWidth(2.5);
        hlPaint.setColor(parseColor(ck, "#FBBF24"));
        const hlRRect = ck.RRectXY(
          ck.LTRBRect(
            rn.absX - 3,
            rn.absY - 3,
            rn.absX + rn.absW + 3,
            rn.absY + rn.absH + 3,
          ),
          8,
          8,
        );
        canvas.drawRRect(hlRRect, hlPaint);
        hlPaint.delete();
      }
    }

    // Draw frame labels (root frames + reusable components + instances at any depth)
    for (const rn of this.renderNodes) {
      const isReusable = this.reusableIds.has(rn.node.id);
      const isInstance = this.instanceIds.has(rn.node.id);
      const label = rn.node.name;
      if (
        !label ||
        !shouldDrawFrameLabel(rn.node, rn.clipRect, isReusable, isInstance)
      ) {
        continue;
      }
      this.renderer.drawFrameLabelColored(
        canvas,
        label,
        rn.absX,
        rn.absY,
        isReusable,
        isInstance,
        this.zoom,
      );
    }

    // Draw agent indicators (glow, badges, node borders, preview fills)
    const agentIndicators = getActiveAgentIndicators();
    const agentFrames = getActiveAgentFrames();
    const hasAgentOverlays = agentIndicators.size > 0 || agentFrames.size > 0;

    if (!hasAgentOverlays) {
      this.agentAnimStart = 0;
    }

    if (hasAgentOverlays) {
      const now = Date.now();
      if (this.agentAnimStart === 0) this.agentAnimStart = now;
      const elapsed = now - this.agentAnimStart;
      // Frame glow: smooth fade-in → fade-out (single bell, ~1.2s)
      const GLOW_DURATION = 1200;
      const glowT = Math.min(1, elapsed / GLOW_DURATION);
      const breath = Math.sin(glowT * Math.PI); // 0 → 1 → 0

      // Agent node borders and preview fills (per-element fade-in → fade-out)
      const NODE_FADE_DURATION = 1000;
      for (const rn of this.renderNodes) {
        const indicator = agentIndicators.get(rn.node.id);
        if (!indicator) continue;
        if (!isNodeBorderReady(rn.node.id)) continue;

        const revealAt = getNodeRevealTime(rn.node.id);
        if (revealAt === undefined) continue;
        const nodeElapsed = now - revealAt;
        if (nodeElapsed > NODE_FADE_DURATION) continue;

        // Smooth bell curve: fade in then fade out
        const nodeT = Math.min(1, nodeElapsed / NODE_FADE_DURATION);
        const nodeBreath = Math.sin(nodeT * Math.PI);

        if (isPreviewNode(rn.node.id)) {
          this.renderer.drawAgentPreviewFill(
            canvas,
            rn.absX,
            rn.absY,
            rn.absW,
            rn.absH,
            indicator.color,
            now,
          );
        }

        this.renderer.drawAgentNodeBorder(
          canvas,
          rn.absX,
          rn.absY,
          rn.absW,
          rn.absH,
          indicator.color,
          nodeBreath,
          this.zoom,
        );
      }

      // Agent frame glow and badges
      for (const rn of this.renderNodes) {
        const frame = agentFrames.get(rn.node.id);
        if (!frame) continue;

        this.renderer.drawAgentGlow(
          canvas,
          rn.absX,
          rn.absY,
          rn.absW,
          rn.absH,
          frame.color,
          breath,
          this.zoom,
        );
        this.renderer.drawAgentBadge(
          canvas,
          frame.name,
          rn.absX,
          rn.absY,
          rn.absW,
          frame.color,
          this.zoom,
          now,
        );
      }
    }

    // Hover outline
    if (this.hoveredNodeId && !selectedIds.has(this.hoveredNodeId)) {
      const hovered = this.spatialIndex.get(this.hoveredNodeId);
      if (hovered) {
        this.renderer.drawHoverOutline(
          canvas,
          hovered.absX,
          hovered.absY,
          hovered.absW,
          hovered.absH,
        );
      }
    }

    // Arc handles for selected ellipse
    if (selectedIds.size === 1) {
      const selId = selectedIds.values().next().value as string;
      const selRN = this.spatialIndex.get(selId);
      if (selRN && selRN.node.type === "ellipse") {
        const eNode = selRN.node as EllipseNode;
        this.renderer.drawArcHandles(
          canvas,
          selRN.absX,
          selRN.absY,
          selRN.absW,
          selRN.absH,
          eNode.startAngle ?? 0,
          eNode.sweepAngle ?? 360,
          eNode.innerRadius ?? 0,
          this.zoom,
        );
      }
    }

    // Drawing preview shape
    if (this.previewShape) {
      this.renderer.drawPreview(canvas, this.previewShape);
    }

    // Pen tool preview
    if (this.penPreview) {
      this.renderer.drawPenPreview(canvas, this.penPreview, this.zoom);
    }

    // Selection marquee
    if (this.marquee) {
      this.renderer.drawSelectionMarquee(
        canvas,
        this.marquee.x1,
        this.marquee.y1,
        this.marquee.x2,
        this.marquee.y2,
      );
    }

    canvas.restore();
    this.surface.flush();

    // Keep animating while agent overlays are active (spinning dot + node flashes)
    if (hasAgentOverlays) {
      this.markDirty();
    }
  }

  // ---------------------------------------------------------------------------
  // Entity graph rendering (used by analysis-canvas, not the document render())
  // ---------------------------------------------------------------------------

  /**
   * Render an entity graph onto the given canvas.
   *
   * Draws entity RenderNodes with type-specific fills, confidence-encoded
   * borders, and stale/human-edited visual states. Then draws relationship
   * edges as Bezier curves between entity centers.
   *
   * This method does NOT use the document store — it receives pre-built
   * RenderNodes (from entityToRenderNode) and relationship data directly.
   */
  renderEntityGraph(
    canvas: Canvas,
    entityRenderNodes: RenderNode[],
    relationships: AnalysisRelationship[],
    entities: AnalysisEntity[],
  ) {
    const entityMap = new Map<string, AnalysisEntity>();
    for (const e of entities) entityMap.set(e.id, e);

    // ── Draw relationship edges in 3 passes: structural (back) → evidence → downstream (front) ──
    if (this.routedEdges.length > 0) {
      const routedByCategory: Record<string, RoutedEdge[]> = {
        structural: [],
        evidence: [],
        downstream: [],
      };
      for (const edge of this.routedEdges) {
        routedByCategory[edge.category].push(edge);
      }
      for (const category of [
        "structural",
        "evidence",
        "downstream",
      ] as const) {
        for (const edge of routedByCategory[category]) {
          this.drawRoutedEdge(canvas, edge);
        }
      }
    } else {
      // Fallback to old center-to-center drawing if no routed edges
      const posMap = new Map<string, { cx: number; cy: number }>();
      for (const rn of entityRenderNodes) {
        posMap.set(rn.node.id, {
          cx: rn.absX + rn.absW / 2,
          cy: rn.absY + rn.absH / 2,
        });
      }
      const edgesByCategory: Record<string, typeof relationships> = {
        structural: [],
        evidence: [],
        downstream: [],
      };
      for (const rel of relationships) {
        const cat = RELATIONSHIP_CATEGORY[rel.type] ?? "structural";
        edgesByCategory[cat].push(rel);
      }
      for (const category of [
        "structural",
        "evidence",
        "downstream",
      ] as const) {
        for (const rel of edgesByCategory[category]) {
          const from = posMap.get(rel.fromEntityId);
          const to = posMap.get(rel.toEntityId);
          if (from && to) this.drawRelationshipEdge(canvas, from, to, rel.type);
        }
      }
    }

    // ── Draw entity nodes ──
    for (const rn of entityRenderNodes) {
      const entity = entityMap.get(rn.node.id);
      this.drawEntityNode(canvas, rn, entity);
    }
  }

  // ── Entity type colors (from DESIGN.md Entity Type Palette) ──

  private static ENTITY_TYPE_COLOR: Record<string, string> = {
    player: "#60A5FA",
    objective: "#818CF8",
    game: "#FBBF24",
    strategy: "#F59E0B",
    fact: "#94A3B8",
    payoff: "#FCD34D",
    "institutional-rule": "#A1A1AA",
    "escalation-rung": "#4ADE80",
    "interaction-history": "#60A5FA",
    "repeated-game-pattern": "#94A3B8",
    "trust-assessment": "#34D399",
    "dynamic-inconsistency": "#F472B6",
    "signaling-effect": "#F472B6",
    "payoff-matrix": "#FCD34D",
    "game-tree": "#FBBF24",
    "equilibrium-result": "#A78BFA",
    "cross-game-constraint-table": "#A1A1AA",
    "cross-game-effect": "#A1A1AA",
    "signal-classification": "#F472B6",
    "bargaining-dynamics": "#F59E0B",
    "option-value-assessment": "#FCD34D",
    "behavioral-overlay": "#F97316",
    assumption: "#CBD5E1",
    "eliminated-outcome": "#EF4444",
    scenario: "#22D3EE",
    "central-thesis": "#A78BFA",
    "meta-check": "#F97316",
  };

  /** Resolve entity type color, with player index hue pool support. */
  private entityColor(entityType: EntityType): string {
    return SkiaEngine.ENTITY_TYPE_COLOR[entityType] ?? "#A1A1AA";
  }

  // ── Draw a single entity node ──

  private drawEntityNode(
    canvas: Canvas,
    rn: RenderNode,
    entity: AnalysisEntity | undefined,
  ) {
    const ck = this.ck;
    const { absX, absY, absW, absH } = rn;
    const entityType = entity?.type ?? "fact";
    const color = this.entityColor(entityType);
    const confidence = entity?.confidence ?? "medium";
    const isStale = entity?.stale ?? false;
    const isHumanEdited = entity?.source === "human";

    const nodeOpacity = isStale ? 0.4 : 1.0;

    // ── Human-edited glow (subtle shadow in entity color, behind everything) ──
    if (isHumanEdited && !isStale) {
      const glowPaint = new ck.Paint();
      glowPaint.setStyle(ck.PaintStyle.Fill);
      glowPaint.setAntiAlias(true);
      const gc = parseColor(ck, color);
      gc[3] = 0.25;
      glowPaint.setColor(gc);
      const sigma = 6;
      const filter = ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, sigma, true);
      glowPaint.setMaskFilter(filter);
      const glowRRect = ck.RRectXY(
        ck.LTRBRect(absX - 3, absY - 3, absX + absW + 3, absY + absH + 3),
        8,
        8,
      );
      canvas.drawRRect(glowRRect, glowPaint);
      glowPaint.delete();
    }

    // ── Fill background (base + tinted overlay) ──
    const rrect = ck.RRectXY(
      ck.LTRBRect(absX, absY, absX + absW, absY + absH),
      6,
      6,
    );
    // Base fill: zinc-800 elevated surface (distinct from canvas bg #1a1a1a)
    const bgPaint = new ck.Paint();
    bgPaint.setStyle(ck.PaintStyle.Fill);
    bgPaint.setAntiAlias(true);
    const bgC = parseColor(ck, "#27272A");
    bgC[3] *= nodeOpacity;
    bgPaint.setColor(bgC);
    canvas.drawRRect(rrect, bgPaint);
    bgPaint.delete();
    // Tint overlay: entity type color at 12% opacity
    const tintPaint = new ck.Paint();
    tintPaint.setStyle(ck.PaintStyle.Fill);
    tintPaint.setAntiAlias(true);
    const tintC = parseColor(ck, color);
    tintC[3] = 0.12 * nodeOpacity;
    tintPaint.setColor(tintC);
    canvas.drawRRect(rrect, tintPaint);
    tintPaint.delete();

    // ── Left accent bar (confidence-encoded) ──
    const accentColor = parseColor(ck, color);
    if (confidence === "low") {
      // Dashed accent bar via stroked vertical path
      const accentPaint = new ck.Paint();
      accentPaint.setStyle(ck.PaintStyle.Stroke);
      accentPaint.setAntiAlias(true);
      accentPaint.setStrokeWidth(2);
      accentPaint.setStrokeCap(ck.StrokeCap.Butt);
      accentColor[3] = 0.5 * nodeOpacity;
      accentPaint.setColor(accentColor);
      const dashEffect = ck.PathEffect.MakeDash([6, 4], 0);
      if (dashEffect) accentPaint.setPathEffect(dashEffect);
      const accentPath = new ck.Path();
      accentPath.moveTo(absX + 1, absY + 6);
      accentPath.lineTo(absX + 1, absY + absH - 6);
      canvas.drawPath(accentPath, accentPaint);
      accentPath.delete();
      accentPaint.delete();
    } else {
      // Solid accent bar via filled rect
      const barW = confidence === "high" ? 3 : 2;
      accentColor[3] = (confidence === "high" ? 0.8 : 0.6) * nodeOpacity;
      const accentPaint = new ck.Paint();
      accentPaint.setStyle(ck.PaintStyle.Fill);
      accentPaint.setAntiAlias(true);
      accentPaint.setColor(accentColor);
      canvas.drawRect(
        ck.LTRBRect(absX, absY + 6, absX + barW, absY + absH - 6),
        accentPaint,
      );
      accentPaint.delete();
    }

    // ── Stale badge ──
    if (isStale) {
      // Draw warning circle at top-right corner (16px diameter)
      const badgePaint = new ck.Paint();
      badgePaint.setStyle(ck.PaintStyle.Fill);
      badgePaint.setAntiAlias(true);
      badgePaint.setColor(parseColor(ck, "#FBBF24"));
      canvas.drawCircle(absX + absW - 12, absY + 12, 8, badgePaint);
      badgePaint.delete();
      // Draw inner exclamation mark
      const excPaint = new ck.Paint();
      excPaint.setStyle(ck.PaintStyle.Stroke);
      excPaint.setAntiAlias(true);
      excPaint.setStrokeWidth(1.5);
      excPaint.setStrokeCap(ck.StrokeCap.Round);
      excPaint.setColor(parseColor(ck, "#09090B"));
      // Stem
      canvas.drawLine(
        absX + absW - 12,
        absY + 8,
        absX + absW - 12,
        absY + 13,
        excPaint,
      );
      // Dot
      canvas.drawLine(
        absX + absW - 12,
        absY + 15.5,
        absX + absW - 12,
        absY + 15.5,
        excPaint,
      );
      excPaint.delete();
    }

    // ── Draw child text nodes (badge + name + meta) via renderer ──
    const children =
      "children" in rn.node ? (rn.node as any).children : undefined;
    if (children && Array.isArray(children)) {
      canvas.save();
      canvas.clipRRect(rrect, ck.ClipOp.Intersect, true);
      const emptySet = new Set<string>();
      for (const child of children) {
        const childRN: RenderNode = {
          node: {
            ...child,
            x: absX + (child.x ?? 0),
            y: absY + (child.y ?? 0),
          },
          absX: absX + (child.x ?? 0),
          absY: absY + (child.y ?? 0),
          absW: typeof child.width === "number" ? child.width : absW - 31,
          absH: typeof child.height === "number" ? child.height : 20,
        };
        // Override badge text color to entity type color at 70%
        if (child.id?.endsWith("__badge")) {
          const alpha = Math.round(0.7 * 255)
            .toString(16)
            .padStart(2, "0");
          childRN.node = {
            ...childRN.node,
            fill: [{ type: "solid", color: color + alpha }],
          } as PenNode;
        }
        // Adjust text opacity for stale nodes
        if (isStale) {
          childRN.node = { ...childRN.node, opacity: 0.4 } as PenNode;
        }
        this.renderer.drawNode(canvas, childRN, emptySet);
      }
      canvas.restore();
    }
  }

  // ── Relationship edge styling ──

  private static EDGE_STYLE: Record<
    string,
    { color: string; dash?: number[]; width: number; opacity: number }
  > = {
    // Downstream (front, 2px, solid, 40% unfocused)
    "plays-in": { color: "#60A5FA", width: 2, opacity: 0.4 },
    "has-objective": { color: "#818CF8", width: 2, opacity: 0.4 },
    "has-strategy": { color: "#F59E0B", width: 2, opacity: 0.4 },
    produces: { color: "#FBBF24", width: 2, opacity: 0.4 },
    "depends-on": { color: "#60A5FA", width: 2, opacity: 0.4 },
    "derived-from": { color: "#A78BFA", width: 2, opacity: 0.4 },
    // Evidence (middle, 1.5px, dashed, 25% unfocused)
    supports: { color: "#34D399", dash: [6, 4], width: 1.5, opacity: 0.25 },
    contradicts: { color: "#F87171", dash: [6, 4], width: 1.5, opacity: 0.25 },
    "informed-by": {
      color: "#94A3B8",
      dash: [6, 4],
      width: 1.5,
      opacity: 0.25,
    },
    "invalidated-by": {
      color: "#EF4444",
      dash: [6, 4],
      width: 1.5,
      opacity: 0.25,
    },
    // Structural (back, 1px, dotted, 15% unfocused)
    constrains: { color: "#52525B", dash: [2, 3], width: 1, opacity: 0.15 },
    "escalates-to": { color: "#52525B", dash: [2, 3], width: 1, opacity: 0.15 },
    links: { color: "#52525B", dash: [2, 3], width: 1, opacity: 0.15 },
    precedes: { color: "#52525B", dash: [2, 3], width: 1, opacity: 0.15 },
    "conflicts-with": {
      color: "#71717A",
      dash: [2, 3],
      width: 1,
      opacity: 0.15,
    },
  };

  private drawRelationshipEdge(
    canvas: Canvas,
    from: { cx: number; cy: number },
    to: { cx: number; cy: number },
    relType: RelationshipType,
  ) {
    const ck = this.ck;
    const style = SkiaEngine.EDGE_STYLE[relType] ?? {
      color: "#52525B",
      width: 1.5,
      opacity: 0.15,
    };

    const paint = new ck.Paint();
    paint.setStyle(ck.PaintStyle.Stroke);
    paint.setAntiAlias(true);
    paint.setStrokeWidth(style.width);
    paint.setColor(parseColor(ck, style.color));
    paint.setAlphaf(style.opacity);

    if (style.dash) {
      const effect = ck.PathEffect.MakeDash(style.dash, 0);
      if (effect) paint.setPathEffect(effect);
    }

    // Quadratic Bezier: control point offset perpendicular to midpoint
    const midX = (from.cx + to.cx) / 2;
    const midY = (from.cy + to.cy) / 2;
    const dx = to.cx - from.cx;
    const dy = to.cy - from.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Curve amount: 15% of distance, perpendicular to line direction
    const offset = dist > 0 ? dist * 0.15 : 20;
    // Perpendicular unit vector (rotated 90 degrees)
    const px = dist > 0 ? -dy / dist : 0;
    const py = dist > 0 ? dx / dist : 1;
    const cpx = midX + px * offset;
    const cpy = midY + py * offset;

    const path = new ck.Path();
    path.moveTo(from.cx, from.cy);
    path.quadTo(cpx, cpy, to.cx, to.cy);
    canvas.drawPath(path, paint);
    path.delete();
    paint.delete();
  }

  // ── Draw a routed edge as a smooth cubic Bézier through waypoints ──

  private drawRoutedEdge(canvas: Canvas, edge: RoutedEdge) {
    const ck = this.ck;
    const style = SkiaEngine.EDGE_STYLE[edge.relType] ?? {
      color: "#52525B",
      width: 1.5,
      opacity: 0.15,
    };

    const paint = new ck.Paint();
    paint.setStyle(ck.PaintStyle.Stroke);
    paint.setAntiAlias(true);
    paint.setStrokeWidth(style.width);
    paint.setColor(parseColor(ck, style.color));
    paint.setAlphaf(style.opacity);

    if (style.dash) {
      const effect = ck.PathEffect.MakeDash(style.dash, 0);
      if (effect) paint.setPathEffect(effect);
    }

    // Build the full point sequence: from → waypoints → to
    const pts = [edge.from, ...edge.waypoints, edge.to];

    const path = new ck.Path();
    path.moveTo(pts[0].x, pts[0].y);

    if (pts.length === 2) {
      // Degenerate: just a line
      path.lineTo(pts[1].x, pts[1].y);
    } else if (pts.length === 3) {
      // Single quadratic curve
      path.quadTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y);
    } else {
      // Smooth cubic Bézier through waypoints:
      // For each segment between consecutive points, use cubic curves
      // with control points that create smooth transitions.
      //
      // Strategy: treat waypoints as defining a polyline, then smooth each
      // segment using 1/3 rule for control points with direction from
      // neighboring segments.
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];

        if (i === 0) {
          // First segment: use the first point as cp1 and midpoint as cp2
          const cp1x = p0.x + (p1.x - p0.x) * 0.5;
          const cp1y = p0.y;
          const cp2x = p1.x;
          const cp2y = p0.y + (p1.y - p0.y) * 0.5;
          path.cubicTo(cp1x, cp1y, cp2x, cp2y, p1.x, p1.y);
        } else if (i === pts.length - 2) {
          // Last segment: mirror the first segment approach
          const cp1x = p0.x;
          const cp1y = p0.y + (p1.y - p0.y) * 0.5;
          const cp2x = p0.x + (p1.x - p0.x) * 0.5;
          const cp2y = p1.y;
          path.cubicTo(cp1x, cp1y, cp2x, cp2y, p1.x, p1.y);
        } else {
          // Middle segments: straight line (these are the vertical channel segments)
          path.lineTo(p1.x, p1.y);
        }
      }
    }

    canvas.drawPath(path, paint);
    path.delete();
    paint.delete();

    // Arrowhead for downstream edges
    if (edge.category === "downstream") {
      this.drawArrowhead(canvas, edge, style.color, style.opacity);
    }
  }

  // ── Draw an arrowhead triangle at the target port of a downstream edge ──

  private drawArrowhead(
    canvas: Canvas,
    edge: RoutedEdge,
    color: string,
    opacity: number,
  ) {
    const ck = this.ck;
    const ARROW_SIZE = 6;
    const { to } = edge;

    const paint = new ck.Paint();
    paint.setStyle(ck.PaintStyle.Fill);
    paint.setAntiAlias(true);
    paint.setColor(parseColor(ck, color));
    paint.setAlphaf(opacity);

    const path = new ck.Path();

    switch (edge.direction) {
      case "forward":
        // Arrow pointing LEFT (into left port) — tip at to.x, spreads right
        path.moveTo(to.x, to.y);
        path.lineTo(to.x + ARROW_SIZE, to.y - ARROW_SIZE / 2);
        path.lineTo(to.x + ARROW_SIZE, to.y + ARROW_SIZE / 2);
        path.close();
        break;
      case "backward":
        // Arrow pointing RIGHT (into right port) — tip at to.x, spreads left
        path.moveTo(to.x, to.y);
        path.lineTo(to.x - ARROW_SIZE, to.y - ARROW_SIZE / 2);
        path.lineTo(to.x - ARROW_SIZE, to.y + ARROW_SIZE / 2);
        path.close();
        break;
      case "same-phase":
        // Arrow pointing DOWN (into top port) — tip at to.y, spreads up
        path.moveTo(to.x, to.y);
        path.lineTo(to.x - ARROW_SIZE / 2, to.y - ARROW_SIZE);
        path.lineTo(to.x + ARROW_SIZE / 2, to.y - ARROW_SIZE);
        path.close();
        break;
    }

    canvas.drawPath(path, paint);
    path.delete();
    paint.delete();
  }

  // ---------------------------------------------------------------------------
  // Viewport control
  // ---------------------------------------------------------------------------

  setViewport(zoom: number, panX: number, panY: number) {
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    this.panX = panX;
    this.panY = panY;
    useCanvasStore.getState().setZoom(this.zoom);
    useCanvasStore.getState().setPan(this.panX, this.panY);
    this.markDirty();
  }

  zoomToPoint(screenX: number, screenY: number, newZoom: number) {
    if (!this.canvasEl) return;
    const rect = this.canvasEl.getBoundingClientRect();
    const vp = vpZoomToPoint(
      { zoom: this.zoom, panX: this.panX, panY: this.panY },
      screenX,
      screenY,
      rect,
      newZoom,
    );
    this.setViewport(vp.zoom, vp.panX, vp.panY);
  }

  pan(dx: number, dy: number) {
    this.setViewport(this.zoom, this.panX + dx, this.panY + dy);
  }

  getCanvasRect(): DOMRect | null {
    return this.canvasEl?.getBoundingClientRect() ?? null;
  }

  getCanvasSize(): { width: number; height: number } {
    return {
      width: this.canvasEl?.clientWidth ?? 800,
      height: this.canvasEl?.clientHeight ?? 600,
    };
  }

  zoomToFitContent() {
    if (!this.canvasEl || this.renderNodes.length === 0) return;
    const FIT_PADDING = 64;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const rn of this.renderNodes) {
      if (rn.clipRect) continue; // skip children, only root bounds
      minX = Math.min(minX, rn.absX);
      minY = Math.min(minY, rn.absY);
      maxX = Math.max(maxX, rn.absX + rn.absW);
      maxY = Math.max(maxY, rn.absY + rn.absH);
    }
    if (!isFinite(minX)) return;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const cw = this.canvasEl.clientWidth;
    const ch = this.canvasEl.clientHeight;
    const scaleX = (cw - FIT_PADDING * 2) / contentW;
    const scaleY = (ch - FIT_PADDING * 2) / contentH;
    let zoom = Math.min(scaleX, scaleY, 1);
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    this.setViewport(zoom, cw / 2 - centerX * zoom, ch / 2 - centerY * zoom);
  }
}
