// Domain-level canvas operations for persisted analytical state.
// View state (viewport, focus, selection, and entity layout) stays renderer-side.

import {
  updateEntity,
  markDirty,
} from "./entity-graph-service";

// ── Focus event bus ──

const focusListeners = new Set<(entityId: string) => void>();

// ── Public API ──

/**
 * Recalculate entity positions using the given layout strategy.
 * Updates positions in entity-graph-service and marks dirty.
 */
export function layoutEntities(strategy: string): void {
  throw new Error(
    `Layout strategy "${strategy}" is renderer-owned and not available via the server canvas service.`,
  );
}

/**
 * Tag entities with an analytical group label.
 * Persisted as entity metadata — domain grouping, not just visual.
 */
export function groupEntities(entityIds: string[], label: string): void {
  for (const id of entityIds) {
    updateEntity(id, { group: label }, { source: "ai-edited" });
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
