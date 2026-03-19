// Domain-level canvas operations for persisted analytical state.
// Wraps entity-graph-service for layout and grouping.
// View state (viewport, focus, selection) stays renderer-side.

import {
  getAnalysis,
  updateEntity,
  markDirty,
} from "@/services/ai/entity-graph-service";
// ── Layout column mapping ──

const COLUMN_X: Record<string, number> = {
  fact: 100,
  player: 400,
  objective: 400,
  game: 700,
  strategy: 700,
};

const COLUMN_Y_SPACING = 120;
const COLUMN_Y_START = 100;

// ── Layout strategies ──

type LayoutStrategy = "column";

function applyColumnLayout(): void {
  const { entities } = getAnalysis();

  // Group entities by their column bucket
  const groups = new Map<number, string[]>();
  for (const entity of entities) {
    const x = COLUMN_X[entity.type] ?? 400;
    const ids = groups.get(x) ?? [];
    ids.push(entity.id);
    groups.set(x, ids);
  }

  // Assign positions by column + index within column
  for (const [x, ids] of groups) {
    for (let i = 0; i < ids.length; i++) {
      updateEntity(
        ids[i],
        { position: { x, y: i * COLUMN_Y_SPACING + COLUMN_Y_START } },
        { source: "phase-derived" },
      );
    }
  }

  markDirty();
}

const STRATEGIES: Record<LayoutStrategy, () => void> = {
  column: applyColumnLayout,
};

// ── Focus event bus ──

const focusListeners = new Set<(entityId: string) => void>();

// ── Public API ──

/**
 * Recalculate entity positions using the given layout strategy.
 * Updates positions in entity-graph-service and marks dirty.
 */
export function layoutEntities(strategy: string): void {
  const fn = STRATEGIES[strategy as LayoutStrategy];
  if (!fn) {
    throw new Error(`Unknown layout strategy: "${strategy}"`);
  }
  fn();
}

/**
 * Tag entities with an analytical group label.
 * Persisted as entity metadata — domain grouping, not just visual.
 */
export function groupEntities(entityIds: string[], label: string): void {
  for (const id of entityIds) {
    updateEntity(id, { group: label } as any, { source: "phase-derived" });
  }
  markDirty();
}

/**
 * Emit a focus/navigation event for the renderer to consume.
 * The MCP `focus_entity` tool calls this; the renderer subscribes via
 * `onFocusRequest`.
 */
export function emitFocusEvent(entityId: string): void {
  for (const cb of focusListeners) {
    cb(entityId);
  }
}

/**
 * Subscribe to focus navigation requests.
 * Returns an unsubscribe function.
 */
export function onFocusRequest(
  callback: (entityId: string) => void,
): () => void {
  focusListeners.add(callback);
  return () => {
    focusListeners.delete(callback);
  };
}

// ── Testing ──

/** Reset module state. Only for use in tests. */
export function _resetForTest(): void {
  focusListeners.clear();
}
